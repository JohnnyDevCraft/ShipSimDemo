const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),app=path.join(root,'demo-app');
execFileSync('npm',['run','build'],{cwd:app,stdio:'inherit'});
const build=path.join(app,'dist/ng-app/browser'),out=path.join(root,'Weapons');
for(const file of fs.existsSync(out)?fs.readdirSync(out):[])if(/^(main|chunk|polyfills)-[A-Z0-9]+\.js$|^styles-[A-Z0-9]+\.css$/.test(file))fs.rmSync(path.join(out,file));
fs.cpSync(build,out,{recursive:true});
const html=fs.readFileSync(path.join(build,'index.html'),'utf8');
for(const [folder,code] of Object.entries({TacticalOfficer:'toc',PhaseCannon:'epc',PhaserArray:'ebc',Shields:'ssc'}))fs.writeFileSync(path.join(root,folder,'index.html'),html.replace('<head>',`<head><script>if(!location.hash)location.hash='/demo/${code}';</script>`));
