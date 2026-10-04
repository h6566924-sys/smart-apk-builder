const { splitRepo, getToken } = require('./_github');

module.exports = async (req,res)=>{
  try{
    if(req.method!=='GET') return res.status(405).json({ok:false,error:'Method Not Allowed'});
    const repo=String(req.query?.repo || '').trim();
    const artifact_id=String(req.query?.artifact_id || '').trim();
    const {owner,name}=splitRepo(repo);
    if(!artifact_id) return res.status(400).json({ok:false,error:'artifact_id مطلوب'});
    const token=getToken(req);
    if(!token) return res.status(401).json({ok:false,error:'GitHub token مفقود'});
    const url=`https://api.github.com/repos/${owner}/${name}/actions/artifacts/${encodeURIComponent(artifact_id)}/zip`;
    const r=await fetch(url,{headers:{accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',authorization:`Bearer ${token}`}});
    if(!r.ok) return res.status(r.status).json({ok:false,error:await r.text()});
    const b=Buffer.from(await r.arrayBuffer());
    res.status(200).setHeader('content-type','application/zip').setHeader('content-disposition','attachment; filename="apk-output.zip"');
    res.end(b);
  }catch(e){return res.status(e.status||500).json({ok:false,error:e.message||'تعذر تنزيل artifact'});}
};
