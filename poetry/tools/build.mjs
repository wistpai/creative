import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]||path.join(root,'site-data.json')),'utf8'));
const allowed=['name','headline','description','entry','ig','webapp','operatorName','contactEmail','terms','summary'];
if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('整合資料含非公開設定，停止建置。');
const d=Object.fromEntries(allowed.map(k=>[k,input[k]]));
if(!d.terms?.id||!/^[a-zA-Z0-9._-]{3,80}$/.test(d.terms.id))throw Error('條款版號無效。');
const hash=crypto.createHash('sha256').update(d.terms.text,'utf8').digest('hex');
if(hash!==d.terms.hash)throw Error('條款全文與後台雜湊不一致，停止建置。');
if(d.entry!=='https://wistpai.github.io/creative/poetry/'||d.ig!=='https://www.instagram.com/paiwist/')throw Error('入口或社群網址與專案設定不一致。');
if(d.terms.url!==d.entry+'terms/'+d.terms.id+'.html')throw Error('條款存檔網址與版號不一致。');
if(!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(d.webapp||''))throw Error('需要實際部署的正式投稿網址。');
if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(d.contactEmail||'')||!d.operatorName)throw Error('公開聯絡資訊不完整。');
const displayName=d.operatorName==='Wist（白品鍵）'?'白品鍵（Wist）':d.operatorName;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const inline=s=>esc(s).replace(/https:\/\/[a-zA-Z0-9./_-]+/g,url=>'<a href="'+url+'" target="_blank" rel="noopener noreferrer">'+url+'</a>');
const paragraphs=s=>s.trim().split(/\n\s*\n/).map(p=>'<p>'+inline(p).replaceAll('\n','<br>')+'</p>').join('\n');
const sections=d.terms.text.split('\n## ').slice(1).map(s=>({title:s.split('\n')[0],text:s.slice(s.indexOf('\n')+1)}));
const byTitle=name=>{const s=sections.find(s=>s.title===name);if(!s)throw Error('條款缺少段落：'+name);return paragraphs(s.text);};
const termLink='./terms/'+d.terms.id+'.html';
const officialCC='https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh-hant';
const mark='<img class="brand-mark" src="./assets/mandala-mark.svg" width="36" height="36" alt="" aria-hidden="true">';
const head=(title,prefix='')=>`<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title><meta name="description" content="${esc(d.headline+' '+d.description)}"><link rel="stylesheet" href="${prefix}style.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin></head>`;
const submit=(text='留下靈感',secondary=false)=>`<a class="button${secondary?' secondary':''}" data-submit href="${esc(d.webapp)}">${text}<span aria-hidden="true">↗</span></a>`;
const ig=()=>`<a class="button secondary" data-ig href="${esc(d.ig)}" target="_blank" rel="noopener noreferrer">已發表詩作<span aria-hidden="true">↗</span></a>`;
const detail=(title,content)=>`<details><summary>${esc(title)}</summary><div class="legal-text">${content}</div></details>`;
const template=fs.readFileSync(path.join(root,'tools/home.html'),'utf8');
const slots={
  HEAD:head('為你寫一首詩｜'+displayName)
    .replace('href="style.css"','href="style.css?v=20261105-2"')
    .replace('</head>','<link rel="icon" type="image/svg+xml" href="./assets/mandala-mark.svg"></head>'),
  MARK:mark,
  SUBMIT:submit(),
  IG:ig(),
  IG_URL:esc(d.ig),
  DISPLAY_NAME:esc(displayName),
  CONTACT_EMAIL:esc(d.contactEmail),
  TERMS_VERSION:esc(d.terms.id),
  TERMS_LINK:termLink,
  OFFICIAL_CC:officialCC,
  DETAILS:detail('詩作如何分享？',byTitle('作者原創詩作的分享授權'))
    +detail('投稿會如何成為創作素材？',byTitle('投稿及創作利用授權'))
    +detail('個人資料如何保存與處理？',byTitle('個人資料告知'))
    +detail('條款版本如何保存？',byTitle('版本保存')+'<p><a href="./terms/">檢視條款版本紀錄</a></p>')
};
const home=template.replace(/\{\{([A-Z_]+)\}\}/g,(_,name)=>{
  if(!Object.hasOwn(slots,name))throw Error('首頁樣板欄位不存在：'+name);
  return slots[name];
});
fs.writeFileSync(path.join(root,'index.html'),home+'\n');
fs.writeFileSync(path.join(root,'config.js'),'/* 集中管理正式投稿網址；只使用部署後的 /exec。 */\nwindow.POETRY_SITE = Object.freeze('+JSON.stringify({submissionUrl:d.webapp,igUrl:d.ig,termsVersion:d.terms.id,termsHash:d.terms.hash},null,2)+');\n');
const termsDir=path.join(root,'terms');fs.mkdirSync(termsDir,{recursive:true});
const snapshot={id:d.terms.id,effective:d.terms.effective,text:d.terms.text,hash:d.terms.hash,url:d.terms.url,summary:d.summary};
const jsonPath=path.join(termsDir,d.terms.id+'.json');
if(fs.existsSync(jsonPath)&&JSON.parse(fs.readFileSync(jsonPath,'utf8')).hash!==hash)throw Error('同一條款版號已存在不同文字，禁止覆寫。');
const mdPath=path.join(termsDir,d.terms.id+'.md');
if(fs.existsSync(mdPath)&&fs.readFileSync(mdPath,'utf8')!==d.terms.text)throw Error('現有條款原文不同，禁止覆寫。');
fs.writeFileSync(jsonPath,JSON.stringify(snapshot,null,2)+'\n');fs.writeFileSync(mdPath,d.terms.text);
const termPage=path.join(termsDir,d.terms.id+'.html');
if(!fs.existsSync(termPage))fs.writeFileSync(termPage,`${head('完整授權與隱私條款｜'+d.terms.id,'../')}<body><main class="wrap document"><a class="back-link" href="../">← 回到為你寫一首詩</a><h1>投稿授權、詩作分享<br>與隱私條款</h1><p class="document-meta">版號：${esc(d.terms.id)}<br>生效時間：${esc(d.terms.text.match(/生效時間：([^\n]+)/)[1])}</p><p class="archive-note">這是保存於後台、供投稿者同意時對應的完整版本。舊版本會持續保存，新版不覆寫舊文字。</p>${sections.map(s=>'<section><h2>'+esc(s.title)+'</h2>'+paragraphs(s.text)+'</section>').join('\n')}<p><a href="./${d.terms.id}.md">下載本版條款原文</a>　<a href="./">版本紀錄</a></p><p class="checksum">全文 SHA-256（安全雜湊演算法）校驗值：${hash}</p><p><a href="../">← 回到計畫介紹</a></p></main></body></html>\n`);
const versions=fs.readdirSync(termsDir).filter(f=>/^v.*\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(path.join(termsDir,f),'utf8'))).sort((a,b)=>b.effective.localeCompare(a.effective));
fs.writeFileSync(path.join(termsDir,'index.html'),`${head('條款版本紀錄｜為你寫一首詩','../')}<body><main class="wrap document"><a class="back-link" href="../">← 回到為你寫一首詩</a><h1>條款版本紀錄</h1><p>每筆投稿保留同意時的版號與時間。以下各版全文分別保存。</p><ul class="version-list">${versions.map(v=>'<li><a href="./'+v.id+'.html">'+esc(v.id)+'</a> <span class="small">'+(v.id===d.terms.id?'目前版本':'保存版本')+'</span></li>').join('')}</ul></main></body></html>\n`);
console.log(JSON.stringify({version:d.terms.id,hash,files:['index.html','config.js','terms/'+d.terms.id+'.html','terms/'+d.terms.id+'.md','terms/'+d.terms.id+'.json','terms/index.html']},null,2));
