const formidable = require('formidable');
const fs = require('fs/promises');
const JSZip = require('jszip');

module.exports.config = { api: { bodyParser: false } };

function out(res, status, body){res.status(status).setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(body));}

module.exports = async (req,res)=>{
  try {
    if(req.method!=='POST') return out(res,405,{ok:false,error:'Method Not Allowed'});
    const form=formidable({multiples:false,maxFileSize:80*1024*1024,allowEmptyFiles:false});
    const [fields,files]=await new Promise((resolve,reject)=>form.parse(req,(e,f,fi)=>e?reject(e):resolve([f,fi])));
    const item=files.project?.[0] || files.file?.[0];
    if(!item) return out(res,400,{ok:false,error:'اختر ملف ZIP'});
    const buf=await fs.readFile(item.filepath);
    const zip=await JSZip.loadAsync(buf);
    const result=[];
    const maxFiles=500;
    const skipPrefixes=['.git/','node_modules/','.gradle/'];
    const skipSegments=['/build/','/dist/','/node_modules/'];
    let count=0;
    let totalBytes=0;
    let skipped=0;
    for(const [rawPath,entry] of Object.entries(zip.files)){
      if(count>=maxFiles) break;
      if(entry.dir) continue;
      const path=rawPath.replace(/\\/g,'/').replace(/^\/+/, '');
      if(!path || path.startsWith('../') || path.includes('/../')) continue;
      const low=path.toLowerCase();
      if(skipPrefixes.some(x=>low.startsWith(x)) || skipSegments.some(x=>low.includes(x))){ skipped++; continue; }
      const data=await entry.async('base64');
      const bytes=Math.floor(data.length*0.75);
      totalBytes+=bytes;
      if(totalBytes>150*1024*1024) throw new Error('حجم الملفات بعد فك ZIP أكبر من 150MB في هذه النسخة');
      result.push({path,content:data,encoding:'base64'});
      count++;
    }
    return out(res,200,{ok:true,count:result.length,files:result,name:item.originalFilename||'project.zip',truncated:Object.keys(zip.files).filter(k=>!zip.files[k].dir).length>maxFiles,skipped});
  }catch(e){return out(res,e.httpCode||500,{ok:false,error:e.message||'تعذر قراءة ZIP'});}
};
