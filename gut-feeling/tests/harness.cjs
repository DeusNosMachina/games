// Runs the built index.html in a Node VM with stub DOM and canvas objects. GF_REDUCED_MOTION=1 makes
// prefers-reduced-motion match; GF_PRELUDE is code run in the page before the game script (stub globals).
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const noop=()=>{};let nodes={},events={},store={};
const ctx=new Proxy({createRadialGradient:()=>({addColorStop:noop}),createLinearGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop,set:(t,k,v)=>{t[k]=v;return true}});
function node(id){return nodes[id]??={id,open:false,textContent:'',innerHTML:'',value:'',width:1000,height:625,style:{setProperty(k,v){this[k]=String(v)},removeProperty(k){delete this[k]}},dataset:{},events:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},setAttribute:noop,getContext:()=>ctx,querySelector:()=>node(id+'child'),addEventListener(type,fn){this.events[type]=fn},getBoundingClientRect:()=>({width:1000,height:625,left:0,top:0}),showModal(){this.open=true},close(){this.open=false;this.events.close?.()},focus:noop,scrollIntoView:noop,setPointerCapture:noop};}
const dialogs=[...html.matchAll(/<dialog id="([^"]+)"/g)].map(m=>node(m[1]));
const items=[0,1,2].map(i=>({...node('item'+i),dataset:{item:String(i)}}));
let cacheCount=0;const doc={createElement:()=>node("cache"+(cacheCount++)),getElementById:node,body:node('body'),hidden:false,addEventListener:noop,querySelectorAll:s=>s==='dialog'?dialogs:s==='dialog[open]'?dialogs.filter(d=>d.open):s==='[data-item]'?items:[]};
const box={document:doc,window:{addEventListener:(t,f)=>events[t]=f},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},matchMedia:q=>({matches:!!process.env.GF_REDUCED_MOTION&&/reduce/.test(q)}),ResizeObserver:class{observe(){}},Path2D:class{constructor(d){this.d=d}},requestAnimationFrame:noop,HTMLInputElement:class{},Math:Object.create(Math),console};vm.createContext(box);if(process.env.GF_PRELUDE)vm.runInContext(process.env.GF_PRELUDE,box);vm.runInContext(script,box);const run=s=>vm.runInContext(s,box);const close=()=>run('mini.open=false;mini.screen="lobby";for(const d of $$("dialog"))d.close();state.paused=false;');

module.exports={run,nodes,events,box,close,assert};
