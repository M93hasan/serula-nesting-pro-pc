'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

function resolveBuildMetadata({pcVersion,webVersion,webCommit,sourceDir}){
  if(typeof pcVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(pcVersion))
    throw Error('Invalid PC version.');
  if(pcVersion!==webVersion)
    throw Error('PC/Web sürümleri uyuşmuyor: PC '+pcVersion+', web '+webVersion+
      '. Çevrimdışı paketleme durduruldu.');
  let sha=webCommit;
  if(!sha&&sourceDir){
    const git=spawnSync('git',['-C',path.resolve(sourceDir,'..'),'rev-parse','HEAD'],{
      encoding:'utf8',windowsHide:true
    });
    if(git.status===0)sha=git.stdout.trim();
  }
  if(typeof sha!=='string'||!/^[a-f0-9]{40}$/i.test(sha))
    throw Error('Web kaynak commit SHA doğrulanamadı. SERULA_WEB_SHA ayarlayın.');
  return {schema:1,pcVersion,webVersion,webCommit:sha,
    packagedAt:new Date().toISOString()};
}
module.exports={resolveBuildMetadata};
