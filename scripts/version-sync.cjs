'use strict';
const path=require('node:path');
const {spawnSync}=require('node:child_process');

function resolveBuildMetadata({pcVersion,webVersion,webCommit,sourceDir}){
  if(typeof pcVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(pcVersion))
    throw Error('Invalid PC version.');
  if(typeof webVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(webVersion))
    throw Error('Invalid web version.');
  // PC and web releases have independent version lifecycles. Record both;
  // the immutable web commit SHA identifies exactly what was bundled offline.
  let sha=webCommit;
  if(!sha&&sourceDir){
    const git=spawnSync('git',['-C',path.resolve(sourceDir,'..'),'rev-parse','HEAD'],{
      encoding:'utf8',windowsHide:true
    });
    if(git.status===0)sha=git.stdout.trim();
  }
  if(typeof sha!=='string'||!/^[a-f0-9]{40}$/i.test(sha))
    throw Error('Web source commit SHA could not be verified. Set SERULA_WEB_SHA.');
  return {schema:1,pcVersion,webVersion,webCommit:sha,
    packagedAt:new Date().toISOString()};
}
module.exports={resolveBuildMetadata};
