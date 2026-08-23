export type Platform="greenhouse"|"lever"|"ashby"|"workday"|"smartrecruiters"|"icims"|"generic";
export type Control={index:number;label:string;type:string;required:boolean};
export type FillAction={kind:"fill"|"select"|"upload";index:number;value:string};
export type FillPlan={actions:FillAction[];state:"review_ready"|"paused";reason?:string};

const sensitive=/(sponsor|citizen|authorization|disab|veteran|gender|race|ethnic|criminal|clearance|salary|compensation)/i;
const known:Record<string,string[]>={firstName:["first name","given name"],lastName:["last name","family name","surname"],email:["email"],phone:["phone","telephone"],linkedin:["linkedin"],website:["portfolio","website"]};

export function detectPlatform(url:string):Platform{const host=new URL(url).hostname.toLowerCase();if(host.includes("greenhouse"))return"greenhouse";if(host.includes("lever.co"))return"lever";if(host.includes("ashbyhq"))return"ashby";if(host.includes("myworkdayjobs"))return"workday";if(host.includes("smartrecruiters"))return"smartrecruiters";if(host.includes("icims"))return"icims";return"generic";}

export function planFormFill(platform:Platform,controls:Control[],profile:Record<string,string>,approvedAnswers:Record<string,string>,resumePath:string):FillPlan{
  const actions:FillAction[]=[];
  for(const control of controls){const label=control.label.trim();if(control.type==="file"){actions.push({kind:"upload",index:control.index,value:resumePath});continue;}const answer=approvedAnswers[label.toLocaleLowerCase("en-CA")];if(sensitive.test(label)&&control.required&&!answer)return{actions,state:"paused",reason:"sensitive_or_ambiguous_question"};if(answer){actions.push({kind:control.type==="select-one"?"select":"fill",index:control.index,value:answer});continue;}const key=Object.entries(known).find(([,aliases])=>aliases.some(alias=>label.toLowerCase().includes(alias)))?.[0];if(key&&profile[key]){actions.push({kind:control.type==="select-one"?"select":"fill",index:control.index,value:profile[key]!});continue;}if(control.required&&!["hidden","checkbox","radio","submit","button"].includes(control.type))return{actions,state:"paused",reason:"unknown_required_field"};}
  if(["workday","smartrecruiters","icims"].includes(platform))return{actions,state:"paused",reason:"assisted_multi_page_flow"};
  return{actions,state:"review_ready"};
}
