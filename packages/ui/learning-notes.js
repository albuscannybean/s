const LEARNING_SECTIONS=Object.freeze({
  concept:[
    ['问题与意义','这个概念试图解决什么问题？'],
    ['定义与条件','准确写下定义，并辨认每一个条件。'],
    ['例子与反例','构造一个满足定义的例子和一个不满足的反例。'],
    ['独立检验','合上资料后，重新解释定义或完成一道相关题目。'],
    ['下一步','还有什么尚未理解？下一次从哪里继续？']
  ],
  proof:[
    ['目标与前提','明确需要证明的结论和允许使用的条件。'],
    ['自己的证明','先独立尝试。哪一步真正推动了结论？'],
    ['缺口与修正','检查每一步的依据；记录失败的想法或反例。'],
    ['独立复现','不看解答，再次完整证明。']
  ],
  problem:[
    ['题目与已知条件','写下题目，识别对象、条件与目标。'],
    ['独立尝试','先计算或推导，保留关键步骤。'],
    ['核验与错误','检查结论、适用边界与出错位置。'],
    ['方法与再练习','总结触发条件、核心动作与有效原因；另选一题独立完成。']
  ],
  organize:[
    ['主题与位置','这部分在课程中解决什么问题？依赖哪些基础？'],
    ['定义与定理','写出严格表述及必要条件。'],
    ['证明与方法','挑选最关键的证明或计算，亲自完成。'],
    ['联系与边界','标记真实依赖、应用、例子和反例。'],
    ['掌握检验','列出之后需要不看笔记完成的任务。']
  ]
});

const ENGLISH_SECTIONS=Object.freeze({
  concept:[['Question and purpose','What problem does this concept solve?'],['Definition and assumptions','State the definition precisely and examine every condition.'],['Examples and counterexamples','Find one example that satisfies the definition and one that does not.'],['Independent check','Without looking at the source, explain the definition or solve a related problem.'],['Next step','What remains unclear? Where will you continue?']],
  proof:[['Goal and assumptions','State the conclusion and available premises.'],['My proof attempt','Try independently first. Which step truly advances the argument?'],['Gaps and revisions','Check the justification for every step; record failed approaches or counterexamples.'],['Reproduce independently','Prove the result again without looking at the solution.']],
  problem:[['Problem and given conditions','Record the problem, objects, assumptions, and goal.'],['Independent attempt','Calculate or derive first, preserving the key steps.'],['Verification and errors','Check the answer, applicability, and exact point of error.'],['Method and transfer','Record triggers, key operations, and why they work; solve another problem independently.']],
  organize:[['Topic and context','What problem does this topic solve? What does it depend on?'],['Definitions and theorems','State results precisely and preserve necessary assumptions.'],['Proofs and methods','Complete a representative proof or calculation yourself.'],['Connections and boundaries','Record genuine dependencies, uses, examples, and counterexamples.'],['Mastery check','List tasks to complete later without looking at notes.']]
});

export const LEARNING_MODES=Object.freeze(Object.keys(LEARNING_SECTIONS));

export function learningNoteBody(mode='concept',language='zh-CN'){
  const collection=language==='en'?ENGLISH_SECTIONS:LEARNING_SECTIONS;
  const sections=collection[mode]??collection.concept;
  return sections.map(([title,prompt])=>`## ${title}\n\n${prompt}\n`).join('\n');
}

