const { gh, json, readBody, splitRepo } = require('./_github');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { ok:false, error:'Method Not Allowed' });
    const b = await readBody(req);
    const action = String(b.action || '');

    if (action === 'whoami') {
      const { data } = await gh(req, '/user');
      return json(res, 200, { ok:true, user:{ login:data.login, name:data.name, avatar:data.avatar_url, type:data.type } });
    }

    if (action === 'repos') {
      const page = Math.max(1, Number(b.page || 1));
      const per = Math.min(100, Math.max(1, Number(b.per_page || 100)));
      const q = `/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=${per}&page=${page}`;
      const { data } = await gh(req, q);
      return json(res, 200, { ok:true, repos:data.map(r => ({ full_name:r.full_name, private:r.private, default_branch:r.default_branch, description:r.description || '', updated_at:r.updated_at, permissions:r.permissions || {} })) });
    }

    if (action === 'repo') {
      const { owner, name } = splitRepo(b.repo);
      const { data } = await gh(req, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
      return json(res, 200, { ok:true, repo:{ full_name:data.full_name, private:data.private, default_branch:data.default_branch, permissions:data.permissions || {}, html_url:data.html_url } });
    }

    if (action === 'write-workflow') {
      const { owner, name } = splitRepo(b.repo);
      const path = '.github/workflows/rafiki-apk-builder.yml';
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const content = String(b.content || '');
      if (!content) return json(res, 400, { ok:false, error:'ملف workflow فارغ' });
      let existingSha = null;
      try {
        const r = await gh(req, `/repos/${owner}/${name}/contents/${encodedPath}`);
        existingSha = r.data.sha;
      } catch (e) { if (e.status !== 404) throw e; }
      const body = { message:'Add/update APK builder workflow', content:Buffer.from(content,'utf8').toString('base64') };
      if (existingSha) body.sha = existingSha;
      if (b.branch) body.branch = b.branch;
      const r = await gh(req, `/repos/${owner}/${name}/contents/${encodedPath}`, { method:'PUT', body:JSON.stringify(body) });
      return json(res, 200, { ok:true, commit_sha:r.data.commit?.sha || null, path });
    }

    if (action === 'write-batch') {
      const { owner, name } = splitRepo(b.repo);
      const files = Array.isArray(b.files) ? b.files : [];
      if (!files.length) return json(res, 400, { ok:false, error:'لا توجد ملفات' });
      const ref = b.branch || null;
      let branch = ref;
      if (!branch) {
        const meta = await gh(req, `/repos/${owner}/${name}`);
        branch = meta.data.default_branch;
      }
      const refData = await gh(req, `/repos/${owner}/${name}/git/ref/heads/${encodeURIComponent(branch)}`);
      const parent = refData.data.object.sha;
      const commitData = await gh(req, `/repos/${owner}/${name}/git/commits/${parent}`);
      const baseTree = commitData.data.tree.sha;
      const entries = [];
      for (const f of files) {
        const path = String(f.path || '').replace(/^\/+/, '');
        if (!path || path.startsWith('../') || path.includes('/../')) throw new Error(`مسار غير صالح: ${path}`);
        const enc = String(f.encoding || 'base64');
        const content = String(f.content || '');
        const blob = await gh(req, `/repos/${owner}/${name}/git/blobs`, { method:'POST', body:JSON.stringify({ content, encoding:enc }) });
        entries.push({ path, mode:'100644', type:'blob', sha:blob.data.sha });
      }
      const tree = await gh(req, `/repos/${owner}/${name}/git/trees`, { method:'POST', body:JSON.stringify({ base_tree:baseTree, tree:entries }) });
      const commit = await gh(req, `/repos/${owner}/${name}/git/commits`, { method:'POST', body:JSON.stringify({ message:`Upload project batch (${files.length} files)`, tree:tree.data.sha, parents:[parent] }) });
      await gh(req, `/repos/${owner}/${name}/git/refs/heads/${encodeURIComponent(branch)}`, { method:'PATCH', body:JSON.stringify({ sha:commit.data.sha, force:false }) });
      return json(res, 200, { ok:true, branch, commit_sha:commit.data.sha, count:files.length });
    }

    if (action === 'dispatch') {
      const { owner, name } = splitRepo(b.repo);
      const workflow = String(b.workflow || 'rafiki-apk-builder.yml');
      const ref = String(b.ref || 'main');
      const inputs = b.inputs && typeof b.inputs === 'object' ? b.inputs : {};
      await gh(req, `/repos/${owner}/${name}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, { method:'POST', body:JSON.stringify({ ref, inputs }) });
      return json(res, 200, { ok:true, dispatched:true });
    }

    if (action === 'runs') {
      const { owner, name } = splitRepo(b.repo);
      const params = new URLSearchParams({ per_page:String(Math.min(30, Math.max(1, Number(b.per_page || 10)))) });
      if (b.workflow) params.set('workflow_id', String(b.workflow));
      const { data } = await gh(req, `/repos/${owner}/${name}/actions/runs?${params.toString()}`);
      return json(res, 200, { ok:true, runs:(data.workflow_runs || []).map(x => ({ id:x.id, name:x.name, status:x.status, conclusion:x.conclusion, html_url:x.html_url, created_at:x.created_at, updated_at:x.updated_at, head_sha:x.head_sha })) });
    }

    if (action === 'run') {
      const { owner, name } = splitRepo(b.repo);
      const run = await gh(req, `/repos/${owner}/${name}/actions/runs/${encodeURIComponent(String(b.run_id))}`);
      return json(res, 200, { ok:true, run:{ id:run.data.id, name:run.data.name, status:run.data.status, conclusion:run.data.conclusion, html_url:run.data.html_url, created_at:run.data.created_at, updated_at:run.data.updated_at, head_sha:run.data.head_sha } });
    }

    if (action === 'artifacts') {
      const { owner, name } = splitRepo(b.repo);
      const { data } = await gh(req, `/repos/${owner}/${name}/actions/artifacts?per_page=20`);
      return json(res, 200, { ok:true, artifacts:(data.artifacts || []).map(a => ({ id:a.id, name:a.name, size_in_bytes:a.size_in_bytes, expired:a.expired, archive_download_url:a.archive_download_url, created_at:a.created_at, expires_at:a.expires_at, workflow_run_id:a.workflow_run?.id || null })) });
    }

    return json(res, 400, { ok:false, error:'عملية غير معروفة' });
  } catch (e) {
    return json(res, e.status || 500, { ok:false, error:e.message || 'حدث خطأ', acceptedPermissions:e.acceptedPermissions || null, github:e.data || null });
  }
};
