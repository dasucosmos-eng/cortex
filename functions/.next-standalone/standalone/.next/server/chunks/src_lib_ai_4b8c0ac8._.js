module.exports=[45500,e=>{"use strict";let t={coding:{context:"coding",models:{primary:"gpt-4o",fallback:"gpt-4o-mini",local:"deepseek-coder-v2"},temperature:.2,maxTokens:4096},summarization:{context:"summarization",models:{primary:"gpt-4o-mini",fallback:"gpt-3.5-turbo",local:"phi-3-mini"},temperature:.3,maxTokens:2048},reasoning:{context:"reasoning",models:{primary:"gpt-4o",fallback:"gpt-4o-mini",local:"deepseek-r1"},temperature:.1,maxTokens:4096},embedding:{context:"embedding",models:{primary:"text-embedding-3-small",fallback:"text-embedding-ada-002",local:"all-MiniLM-L6-v2"},temperature:0,maxTokens:512},creative:{context:"creative",models:{primary:"gpt-4o",fallback:"gpt-4o-mini",local:"llama-3-70b"},temperature:.8,maxTokens:3072},analysis:{context:"analysis",models:{primary:"gpt-4o",fallback:"gpt-4o-mini",local:"mistral-large"},temperature:.2,maxTokens:4096},conversation:{context:"conversation",models:{primary:"gpt-4o-mini",fallback:"gpt-3.5-turbo",local:"phi-3-mini"},temperature:.6,maxTokens:2048}},i={normal:{coding:{preferLocal:!1,temperatureAdjust:0},summarization:{preferLocal:!1,temperatureAdjust:0},reasoning:{preferLocal:!1,temperatureAdjust:0},embedding:{preferLocal:!1,temperatureAdjust:0},creative:{preferLocal:!1,temperatureAdjust:0},analysis:{preferLocal:!1,temperatureAdjust:0},conversation:{preferLocal:!1,temperatureAdjust:0}},elevated:{coding:{preferLocal:!0,temperatureAdjust:-.1},summarization:{preferLocal:!0,temperatureAdjust:-.1},reasoning:{preferLocal:!0,temperatureAdjust:-.05},embedding:{preferLocal:!0,temperatureAdjust:0},creative:{preferLocal:!1,temperatureAdjust:-.1},analysis:{preferLocal:!0,temperatureAdjust:-.1},conversation:{preferLocal:!0,temperatureAdjust:-.1}},maximum:{coding:{preferLocal:!0,temperatureAdjust:-.15},summarization:{preferLocal:!0,temperatureAdjust:-.15},reasoning:{preferLocal:!0,temperatureAdjust:-.1},embedding:{preferLocal:!0,temperatureAdjust:0},creative:{preferLocal:!0,temperatureAdjust:-.15},analysis:{preferLocal:!0,temperatureAdjust:-.15},conversation:{preferLocal:!0,temperatureAdjust:-.15}}};function n(e,a="normal"){let o,r,s=t[e];if(!s)throw Error(`Unknown AI context: ${e}`);let c=i[a]?.[e],l=c?.preferLocal??!1,d=c?.temperatureAdjust??0;return l&&s.models.local?(o=s.models.local,r=`Privacy level "${a}" — routing to local model`):(o=s.models.primary,r="Standard routing to primary cloud model"),{...s,selectedModel:o,temperature:Math.max(0,Math.min(2,s.temperature+d)),reason:r}}e.s(["routeToModel",()=>n])},46929,e=>e.a(async(t,i)=>{try{var n=e.i(41095),a=e.i(69983),o=e.i(45500),r=t([a]);[a]=r.then?(await r)():r;let c={research:{type:"research",name:"Research Agent",description:"Deep research and information gathering agent. Explores topics, finds connections, and synthesizes findings from multiple sources.",systemPrompt:`You are a specialized Research Agent within a Cognitive Operating System. Your role is to:

1. Analyze research queries and break them into sub-topics
2. Identify key concepts, technologies, and relationships
3. Synthesize findings into structured, actionable insights
4. Identify knowledge gaps and suggest follow-up research directions
5. Cross-reference with existing knowledge from the user's memory store

Always provide structured output with:
- Key findings (numbered list)
- Related concepts and entities
- Confidence level for each finding (high/medium/low)
- Suggested next research steps
- Connections to existing knowledge

Respond in valid JSON format when possible.`,capabilities:["topic-analysis","entity-extraction","cross-referencing","gap-detection","synthesis"],model:"reasoning"},coding:{type:"coding",name:"Coding Agent",description:"Code generation, analysis, and debugging assistant. Understands codebases and provides implementation guidance.",systemPrompt:`You are a specialized Coding Agent within a Cognitive Operating System. Your role is to:

1. Analyze code requirements and generate high-quality implementations
2. Review existing code for bugs, performance issues, and best practices
3. Suggest refactoring and optimization strategies
4. Explain complex code patterns and architecture decisions
5. Generate tests and documentation

Always provide:
- Clean, well-commented code
- Explanation of the approach
- Potential edge cases
- Performance considerations
- Dependencies or prerequisites

Prefer modern patterns and the user's existing tech stack. Respond in valid JSON when possible.`,capabilities:["code-generation","code-review","debugging","refactoring","testing","documentation"],model:"reasoning"},summarization:{type:"summarization",name:"Summarization Agent",description:"Creates concise summaries of sessions, documents, and complex information while preserving key insights.",systemPrompt:`You are a specialized Summarization Agent within a Cognitive Operating System. Your role is to:

1. Condense long-form content into clear, actionable summaries
2. Extract key decisions, findings, and action items
3. Identify the most important information at different abstraction levels
4. Generate topic tags and categories
5. Create hierarchical summaries (executive, detailed, technical)

Always structure summaries with:
- One-sentence overview
- Key points (bullet list)
- Decisions made
- Action items
- Related topics/tags

Adapt the detail level to the audience. Respond in valid JSON when possible.`,capabilities:["text-summarization","topic-extraction","key-point-identification","hierarchical-summarization","tag-generation"],model:"fast"},timeline:{type:"timeline",name:"Timeline Agent",description:"Analyzes activity patterns, builds timelines, and detects workflow interruptions for session continuity.",systemPrompt:`You are a specialized Timeline Agent within a Cognitive Operating System. Your role is to:

1. Analyze sequences of events to understand workflow patterns
2. Detect interruptions and context switches
3. Identify productivity patterns and peak focus periods
4. Generate timeline summaries and activity reports
5. Suggest optimal task ordering and time allocation

Provide structured output with:
- Timeline visualization data (structured events)
- Pattern analysis (focus periods, interruptions)
- Productivity metrics
- Workflow optimization suggestions

Respond in valid JSON when possible.`,capabilities:["pattern-detection","interruption-detection","productivity-analysis","timeline-generation","workflow-optimization"],model:"reasoning"},curator:{type:"curator",name:"Memory Curator Agent",description:"Manages memory lifecycle: deduplication, compression, importance scoring, and hierarchical organization.",systemPrompt:`You are a specialized Memory Curator Agent within a Cognitive Operating System. Your role is to:

1. Detect and merge duplicate or near-duplicate memories
2. Compress repetitive memories into consolidated summaries
3. Score memory importance based on recency, connections, and relevance
4. Organize memories into hierarchical structures
5. Identify memories suitable for archival

For each operation provide:
- List of affected memories
- Reasoning for each decision
- Preserved key information
- Updated memory content/structure

Be conservative with deletions — always preserve unique information. Respond in valid JSON when possible.`,capabilities:["deduplication","compression","importance-scoring","hierarchy-building","archival","merge-detection"],model:"fast"},optimizer:{type:"optimizer",name:"Context Optimizer Agent",description:"Optimizes AI context windows by selecting the most relevant information and minimizing token usage.",systemPrompt:`You are a specialized Context Optimizer Agent within a Cognitive Operating System. Your role is to:

1. Select the most relevant memories and context for a given task
2. Compress context to fit within token limits while preserving meaning
3. Rank context items by relevance score
4. Identify redundant context that can be safely removed
5. Generate compact context capsules for AI processing

Provide structured output with:
- Selected context items (ranked by relevance)
- Removed items with justification
- Token usage estimate
- Compression ratio
- Any information loss warnings

Respond in valid JSON when possible.`,capabilities:["context-selection","token-optimization","relevance-ranking","compression","context-capsule-generation"],model:"fast"},connector:{type:"connector",name:"Knowledge Connector Agent",description:"Discovers and creates connections between memories, concepts, and knowledge graph nodes.",systemPrompt:`You are a specialized Knowledge Connector Agent within a Cognitive Operating System. Your role is to:

1. Find hidden relationships between seemingly unrelated memories
2. Build knowledge graph edges between connected concepts
3. Detect emerging patterns and clusters
4. Suggest potential connections the user may not have considered
5. Maintain graph health by pruning weak connections

Provide structured output with:
- New connections discovered (source → target → type → strength)
- Connection reasoning
- Pattern observations
- Suggested graph reorganizations

Respond in valid JSON when possible.`,capabilities:["relationship-discovery","graph-building","pattern-detection","connection-suggestion","graph-maintenance"],model:"creative"},debugging:{type:"debugging",name:"Debugging Agent",description:"Analyzes errors, traces issues, and provides systematic debugging strategies with root cause analysis.",systemPrompt:`You are a specialized Debugging Agent within a Cognitive Operating System. Your role is to:

1. Analyze error messages and stack traces
2. Identify root causes through systematic elimination
3. Trace code execution paths to locate issues
4. Suggest debugging strategies and tools
5. Verify fixes and prevent regression

Provide structured output with:
- Error classification and severity
- Root cause analysis (most likely → least likely)
- Step-by-step reproduction guide
- Suggested fixes (with code if applicable)
- Prevention strategies

Be methodical and thorough. Always consider edge cases. Respond in valid JSON when possible.`,capabilities:["error-analysis","root-cause-detection","trace-analysis","fix-generation","regression-prevention"],model:"reasoning"}},l={low:0,medium:1,high:2,critical:3},d=new Map;class m{taskQueue=[];isProcessing=!1;getConfigs(){return{...c}}getConfig(e){return c[e]}route(e){let t=c[e.agentType];if(!t)throw Error(`Unknown agent type: ${e.agentType}`);return t}async buildContext(e){let t={...e.context};if(e.context.sessionId){let i=(await a.adminDb.collection("memories").where("sessionId","==",e.context.sessionId).orderBy("createdAt","desc").limit(20).get()).docs.map(e=>({id:e.id,...e.data()}));t.relevantMemories=[...t.relevantMemories,...i.map(e=>({id:e.id,type:e.type,content:e.content,summary:e.summary,tags:e.tags,createdAt:e.createdAt}))]}if(e.context.memoryId){let i=await a.adminDb.collection("memories").doc(e.context.memoryId).get();if(i.exists){let n={id:i.id,...i.data()};t.relevantMemories.some(e=>e.id===n.id)||t.relevantMemories.unshift({id:n.id,type:n.type,content:n.content,summary:n.summary,tags:n.tags,createdAt:n.createdAt});let o=await a.adminDb.collection("memoryRelations").where("fromId","==",e.context.memoryId).get(),r=new Set;for(let e of o.docs){let t=e.data();r.add(t.toId)}for(let t of(await a.adminDb.collection("memoryRelations").where("toId","==",e.context.memoryId).get()).docs){let e=t.data();r.add(e.fromId)}if(r.size>0){let e=Array.from(r).slice(0,30);for(let i of(await a.adminDb.collection("memories").where("id","in",e).limit(10).get()).docs.map(e=>({id:e.id,...e.data()})))t.relevantMemories.some(e=>e.id===i.id)||t.relevantMemories.push({id:i.id,type:i.type,content:i.content,summary:i.summary,tags:i.tags,createdAt:i.createdAt})}}}if(e.context.projectId)for(let i of(await a.adminDb.collection("memories").where("projectId","==",e.context.projectId).orderBy("createdAt","desc").limit(15).get()).docs.map(e=>({id:e.id,...e.data()})))t.relevantMemories.some(e=>e.id===i.id)||t.relevantMemories.push({id:i.id,type:i.type,content:i.content,summary:i.summary,tags:i.tags,createdAt:i.createdAt});return t}async execute(e){let t=Date.now(),i=this.route(e),a=await this.buildContext(e),r=d.get(e.id);r&&(r.status="running",r.startedAt=new Date);try{let s=(0,o.routeToModel)("fast"===i.model?"conversation":"reasoning"===i.model?"reasoning":"creative","normal"),c=a.relevantMemories.length>0?`

--- Relevant Context ---
${a.relevantMemories.slice(0,10).map((e,t)=>`[${t+1}] [${e.type}] ${e.summary||String(e.content).substring(0,200)}`).join("\n")}
--- End Context ---`:"",l="string"==typeof e.input.query?`${e.input.query}${c}`:`${JSON.stringify(e.input,null,2)}${c}`,d=await n.default.create(),m=await d.chat.completions.create({model:s.primary,messages:[{role:"assistant",content:i.systemPrompt},{role:"user",content:l}],temperature:s.temperature,max_tokens:s.maxTokens}),u=m.choices?.[0]?.message?.content||"",p=m.usage?.total_tokens||0,g=Date.now()-t,y={response:u};try{let e=u.match(/```(?:json)?\s*([\s\S]*?)```/),t=e?e[1]:u,i=JSON.parse(t.trim());"object"==typeof i&&null!==i&&(y=i)}catch{}let h={taskId:e.id,agentType:e.agentType,status:"success",output:y,confidence:u.length>50?.8:.5,tokensUsed:p,duration:g,followUpActions:this.extractFollowUpActions(y,e.agentType)};return r&&(r.status="success",r.result=h,r.completedAt=new Date),h}catch(o){let i=Date.now()-t,n=o instanceof Error?o.message:"Unknown error",a={taskId:e.id,agentType:e.agentType,status:"failed",output:{error:n},confidence:0,tokensUsed:0,duration:i,followUpActions:["Retry with modified input","Check agent configuration","Try a different agent type"]};return r&&(r.status="failed",r.result=a,r.completedAt=new Date),a}}async chain(e,t,i){let n=[],a=e;for(let e=0;e<t.length;e++){let o=t[e];if(o.condition&&n.length>0){let e=n[n.length-1];if(!o.condition(e))break}o.inputMapper&&n.length>0&&(a=o.inputMapper(n[n.length-1]));let r={id:`chain-${Date.now()}-${e}`,agentType:o.agentType,input:a,context:i||{relevantMemories:[],knowledgeGraph:{}},priority:"medium",createdAt:new Date};d.set(r.id,{taskId:r.id,agentType:r.agentType,status:"pending",createdAt:new Date});let s=await this.execute(r);if(n.push(s),"failed"===s.status)break}return n}enqueue(e){return this.taskQueue.push(e),this.taskQueue.sort((e,t)=>l[t.priority]-l[e.priority]),d.set(e.id,{taskId:e.id,agentType:e.agentType,status:"pending",createdAt:new Date}),this.isProcessing||this.processQueue(),e.id}async processQueue(){for(this.isProcessing=!0;this.taskQueue.length>0;){let e=this.taskQueue.shift();if(!e)break;let t=d.get(e.id);t?.status!=="cancelled"&&await this.execute(e)}this.isProcessing=!1}getStats(){let e={research:{total:0,success:0,failed:0,totalDuration:0},coding:{total:0,success:0,failed:0,totalDuration:0},summarization:{total:0,success:0,failed:0,totalDuration:0},timeline:{total:0,success:0,failed:0,totalDuration:0},curator:{total:0,success:0,failed:0,totalDuration:0},optimizer:{total:0,success:0,failed:0,totalDuration:0},connector:{total:0,success:0,failed:0,totalDuration:0},debugging:{total:0,success:0,failed:0,totalDuration:0}};for(let t of d.values()){let i=e[t.agentType];i.total++,"success"===t.status&&i.success++,"failed"===t.status&&i.failed++,t.result&&(i.totalDuration+=t.result.duration)}let t={};for(let[i,n]of Object.entries(e))t[i]={total:n.total,success:n.success,failed:n.failed,avgDuration:n.total>0?Math.round(n.totalDuration/n.total):0};return t}getRecentExecutions(e=20){return Array.from(d.values()).sort((e,t)=>t.createdAt.getTime()-e.createdAt.getTime()).slice(0,e)}getExecution(e){return d.get(e)}cancelExecution(e){let t=d.get(e);return!!t&&("pending"===t.status||"running"===t.status)&&(t.status="cancelled",this.taskQueue=this.taskQueue.filter(t=>t.id!==e),!0)}getQueueStatus(){return{length:this.taskQueue.length,isProcessing:this.isProcessing,pendingTasks:this.taskQueue.map(e=>({id:e.id,agentType:e.agentType,priority:e.priority}))}}extractFollowUpActions(e,t){let i=[];return Array.isArray(e.followUpSteps)&&i.push(...e.followUpSteps.map(String)),Array.isArray(e.nextSteps)&&i.push(...e.nextSteps.map(String)),Array.isArray(e.suggestions)&&i.push(...e.suggestions.map(String)),0===i.length&&i.push(...{research:["Deep dive into identified topics","Cross-reference with existing knowledge"],coding:["Review generated code","Write tests for implementation"],summarization:["Archive summary","Generate related summaries"],timeline:["Review activity patterns","Optimize workflow schedule"],curator:["Review merged memories","Check for remaining duplicates"],optimizer:["Apply optimized context","Monitor token usage"],connector:["Validate new connections","Explore detected clusters"],debugging:["Apply suggested fix","Run tests to verify"]}[t]||[]),i.slice(0,5)}}let u=null;function s(){return u||(u=new m),u}e.s(["getOrchestrator",()=>s]),i()}catch(e){i(e)}},!1)];

//# sourceMappingURL=src_lib_ai_4b8c0ac8._.js.map