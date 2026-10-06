import sharp from "sharp";
import { storyboardQcMode } from "../src/storyboardQc.js";
import { storyboardQcUnavailable } from "../src/storyboardPlanValidation.js";
const essential = new Set(["identity","missing_cast","spatial","action","prop","physical","rendering"]);
export function storyboardQcDecision(qc) {
 if(qc.confidence !== "high" || qc.needsDetail !== false) return storyboardQcUnavailable(qc.summary || "Review was uncertain.");
 if(qc.pass === false && qc.severity === "major" && essential.has(qc.failureType)) return {...qc,shouldRetry:qc.shouldRetry===true};
 if((qc.pass !== true && qc.failureType !== "polish") || essential.has(qc.failureType) || (qc.severity === "major" && qc.failureType !== "polish")) return storyboardQcUnavailable("Inconsistent review; image preserved without automatic retry.");
 return {...qc,pass:true,shouldRetry:false,severity:qc.failureType === "polish" || qc.severity === "minor" ? "minor":"ok",correctionPrompt:""};
}
export async function storyboardQcImage(asset,limit) {
 return {...asset, buffer:await sharp(asset.buffer).rotate().resize({width:limit,height:limit,fit:"inside",withoutEnlargement:true}).flatten({background:"#ffffff"}).png().toBuffer(),mimeType:"image/png",fileName:"storyboard-qc.png"};
}
export async function runStoryboardQc({ input, readAsset, review, recordUsage }) {
 const mode=storyboardQcMode({storyboardQcMode:input.qcMode});
 if(mode === "off") return {qc:{...storyboardQcUnavailable("Automatic review is off."),mode},cost:{amountUsd:0,currency:"USD"}};
 const inputs=[{url:input.sourceUrl,label:"Generated frame to review"},input.previousFrameUrl?{url:input.previousFrameUrl,label:"Previous approved frame for continuity"}:null,input.spatialAnchorUrl && input.spatialAnchorUrl!==input.previousFrameUrl?{url:input.spatialAnchorUrl,label:"Spatial anchor frame for room geography"}:null].filter(Boolean);
 const assets=await Promise.all(inputs.map(item=>readAsset(item.url)));const costs=[];
 const totalCost=()=>({amountUsd:costs.every(c=>Number.isFinite(c?.amountUsd))?costs.reduce((n,c)=>n+c.amountUsd,0):null,currency:"USD",estimated:true,source:"Storyboard review usage"});
 const call=async tier=>{
  const preparedInputs=await Promise.all(inputs.map(async(item,i)=>({...item,asset:mode==="deep"?assets[i]:await storyboardQcImage(assets[i],tier==="routine"?(i===0?1536:1024):2048)})));
  let result;
  try { result=await review({...input,qcMode:mode,preparedInputs,reasoningEffort:tier==="routine"?"low":"high"}); }
  catch(error){costs.push(error.cost || {amountUsd:null});if(error.llmResult){await recordUsage({result:error.llmResult,cost:error.cost},mode+"/"+tier+" (invalid response)");error.qcUsageRecorded=true;}throw error;}
  costs.push(result.cost);await recordUsage(result,mode+"/"+tier);return result.qc;
 };
 try {
  let qc=await call(mode==="deep"?"deep":"routine");
  const escalated=mode==="balanced" && (!qc.pass || qc.severity==="major" || essential.has(qc.failureType) || qc.confidence!=="high" || qc.needsDetail!==false);
  if(escalated)qc=await call("confirmation");
  return {qc:{...storyboardQcDecision(qc),mode,escalated},cost:totalCost()};
 }catch(error){error.cost=totalCost();throw error;}
}
