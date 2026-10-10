import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { analyze } from './analysis.js';

dotenv.config();
const app = express();
const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || '';
const TD = process.env.TWELVE_DATA_API_KEY || '';
const LIVE = process.env.LIVE_TRADING_ENABLED === 'true';
const CONF = process.env.LIVE_CONFIRMATION || '';
const DATA_FILE = path.join(dir, 'tradex-data.json');

const allowedOrigins=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
app.use(cors({origin(origin,cb){if(!origin||allowedOrigins.length===0||allowedOrigins.includes(origin))return cb(null,true);return cb(new Error('Origin not allowed'))}}));
app.use(express.json({ limit: '256kb' }));
const initial = { settings:{riskPercent:Number(process.env.DEFAULT_RISK_PERCENT||1),maxDailyLoss:Number(process.env.MAX_DAILY_LOSS_PERCENT||5),maxOpenTrades:Number(process.env.MAX_OPEN_TRADES||1),strategyEnabled:true}, mt5:{connected:false}, commands:[], trades:[], day:null };
let S = load();
function load(){ try{return {...initial,...JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))}}catch{return structuredClone(initial)} }
function save(){ fs.writeFileSync(DATA_FILE, JSON.stringify(S,null,2)); }
function admin(req,res,next){ if(!ADMIN_TOKEN || req.get('x-admin-token')!==ADMIN_TOKEN) return res.status(401).json({error:'Unauthorized'}); next(); }
function bridge(req,res,next){ if(!BRIDGE_TOKEN || req.get('x-bridge-token')!==BRIDGE_TOKEN) return res.status(401).json({error:'Unauthorized'}); next(); }
function today(){return new Date().toISOString().slice(0,10)}
function resetDayIfNeeded(){if(S.day?.date!==today()){S.day={date:today(),startEquity:S.mt5?.account?.equity||0,realized:0};save()}}
async function td(ep,q={}){ if(!TD) throw Error('TWELVE_DATA_API_KEY missing'); q.apikey=TD; const r=await fetch('https://api.twelvedata.com/'+ep+'?'+new URLSearchParams(q)); const d=await r.json(); if(!r.ok||d.status==='error') throw Error(d.message||'Market-data error'); return d; }
function normalizeSymbol(s){return String(s||'').replace('/','').replace('-','').toUpperCase()}
function liveAllowed(){return LIVE && CONF==='TRADEX_LIVE_CONFIRM'}
function openCount(){return Array.isArray(S.mt5.positions)?S.mt5.positions.length:0}
function dailyLossPct(){resetDayIfNeeded(); const start=Number(S.day.startEquity||0), eq=Number(S.mt5?.account?.equity||0); return start>0 ? Math.max(0,(start-eq)/start*100) : 0}

app.get('/api/health',(req,res)=>res.json({ok:true,marketData:!!TD,mt5:S.mt5.connected===true,live:liveAllowed(),url:PUBLIC_URL,time:new Date().toISOString()}));
app.get('/api/config',(req,res)=>res.json({name:'TradeX Pro',url:PUBLIC_URL,protocol:PUBLIC_URL.startsWith('https://')?'https':'http'}));
// Public, read-only market endpoints. Keep provider credentials on the server and restrict symbols/intervals.
const marketSymbols = new Set(['XAU/USD','EUR/USD','GBP/USD','BTC/USD']);
const marketIntervals = new Set(['1min','5min','15min','1h','4h','1day']);
const hits = new Map();
function marketRateLimit(req,res,next){
 const key=req.ip||req.socket.remoteAddress||'unknown', now=Date.now(), prior=hits.get(key)||{start:now,count:0};
 if(now-prior.start>60000){prior.start=now;prior.count=0} prior.count++; hits.set(key,prior);
 if(prior.count>90)return res.status(429).json({error:'Market data request limit reached; try again shortly.'}); next();
}
app.get('/api/quote',marketRateLimit,async(req,res)=>{try{const symbol=String(req.query.symbol||'XAU/USD').toUpperCase();if(!marketSymbols.has(symbol))return res.status(400).json({error:'Unsupported market symbol'});res.set('Cache-Control','public, max-age=10');res.json(await td('quote',{symbol}))}catch(e){res.status(502).json({error:e.message})}});
app.get('/api/analysis',marketRateLimit,async(req,res)=>{try{const symbol=String(req.query.symbol||'XAU/USD').toUpperCase(), interval=String(req.query.interval||'15min');if(!marketSymbols.has(symbol))return res.status(400).json({error:'Unsupported market symbol'});if(!marketIntervals.has(interval))return res.status(400).json({error:'Unsupported interval'});const d=await td('time_series',{symbol,interval,outputsize:250});const values=(d.values||[]).reverse();res.set('Cache-Control','public, max-age=15');res.json({symbol,interval,analysis:analyze(values),values:d.values||[]})}catch(e){res.status(502).json({error:e.message})}});
app.get('/api/settings',admin,(req,res)=>{resetDayIfNeeded();res.json({...S.settings,mt5:S.mt5,live:liveAllowed(),dailyLossPct:dailyLossPct(),queued:S.commands.length})});
app.post('/api/settings',admin,(req,res)=>{const x=req.body||{}; if(x.riskPercent!=null)S.settings.riskPercent=Math.max(.1,Math.min(5,Number(x.riskPercent))); if(x.maxDailyLoss!=null)S.settings.maxDailyLoss=Math.max(.5,Math.min(20,Number(x.maxDailyLoss))); if(x.maxOpenTrades!=null)S.settings.maxOpenTrades=Math.max(1,Math.min(20,Number(x.maxOpenTrades))); if(x.strategyEnabled!=null)S.settings.strategyEnabled=!!x.strategyEnabled; save(); res.json(S.settings)});
app.get('/api/positions',admin,(req,res)=>res.json({positions:S.mt5.positions||[],account:S.mt5.account||null}));
app.get('/api/trades',admin,(req,res)=>res.json(S.trades.slice(-100).reverse()));

app.post('/api/order',admin,(req,res)=>{
 const {symbol,side,volume,sl,tp}=req.body||{}; const vol=Number(volume), stop=Number(sl)||0, take=Number(tp)||0;
 if(!symbol||!['BUY','SELL'].includes(side)||!Number.isFinite(vol)||vol<=0) return res.status(400).json({error:'Invalid order'});
 if(vol>100) return res.status(400).json({error:'Volume exceeds safety limit'});
 if(!S.settings.strategyEnabled) return res.status(403).json({error:'Strategy disabled'});
 if(!S.mt5.connected) return res.status(409).json({error:'MT5 is not connected'});
 if(openCount()>=S.settings.maxOpenTrades) return res.status(409).json({error:'Maximum open trades reached'});
 if(dailyLossPct()>=S.settings.maxDailyLoss) return res.status(409).json({error:'Daily loss limit reached'});
 const id=crypto.randomUUID(); const cmd={id,type:'ORDER',symbol:normalizeSymbol(symbol),side,volume:vol,sl:stop,tp:take,createdAt:new Date().toISOString()};
 if(!liveAllowed()) return res.json({accepted:false,demo:true,message:'Safe mode: live execution is disabled.',command:cmd});
 S.commands.push(cmd); save(); res.json({accepted:true,commandId:id,message:'Order queued for MT5 execution.'});
});

app.get('/api/mt5/commands',bridge,(req,res)=>{const commands=S.commands.splice(0,10); save(); res.json({commands})});
app.post('/api/mt5/snapshot',bridge,(req,res)=>{S.mt5={...req.body,connected:true,updated:new Date().toISOString()}; resetDayIfNeeded(); save(); res.json({ok:true})});
app.post('/api/mt5/result',bridge,(req,res)=>{const x=req.body||{}; S.trades.push({...x,receivedAt:new Date().toISOString()}); if(x.realized!=null){resetDayIfNeeded();S.day.realized+=Number(x.realized); } save(); res.json({ok:true})});
app.post('/api/mt5/heartbeat',bridge,(req,res)=>{S.mt5.connected=true;S.mt5.updated=new Date().toISOString();save();res.json({ok:true})});
app.use(express.static(path.join(dir,'public')));
app.listen(PORT,HOST,()=>console.log(`TradeX Pro running at ${PUBLIC_URL}`));
