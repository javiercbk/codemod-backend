const _ = require('lodash');
const jscodeshift = require('jscodeshift');

// const buildCallExpression = (j, expression, args) => {
//   const callee = expression.callee;
//   if (callee.property.name === 'bind') {
//     return j.callExpression({ callee: callee.object, arguments: args });
//   }
// };

const buildAwaitExpression = j => (yi) => {
  let argument = yi.value.argument;
  const coroutineYield = _.get(argument, 'callee');
  if (coroutineYield && coroutineYield.callee) {
    const prom = coroutineYield.callee.object;
    const cor = coroutineYield.callee.property;
    if (prom && cor && prom.name === 'Promise' && cor.name === 'coroutine') {
      const coroutined = coroutineYield.arguments[0];
      argument = j.callExpression(coroutined, argument.arguments);
    }
  }
  const awaitExpression = j.awaitExpression(argument);
  return awaitExpression;
};

const transformToAsyncAwait = j => (p) => {
  j(p)
    .find(j.YieldExpression)
    .forEach((yi) => {
      j(yi).replaceWith(buildAwaitExpression(j));
    });
  p.node.generator = false;
  p.node.async = true;
  return p;
};

const transformToSimpleCall = p => p.node.arguments[0];

module.exports = function (data) {
  const j = jscodeshift;
  const root = j(data);
  // remove all "use strict" statements
  // root.find(j.FunctionDeclaration, { kind: 'var' })
  root.find(j.FunctionDeclaration, { generator: true }).forEach(transformToAsyncAwait(j));
  root.find(j.FunctionExpression, { generator: true }).forEach(transformToAsyncAwait(j));
  root.find(j.MethodDefinition, { generator: true }).forEach(transformToAsyncAwait(j));
  root
    .find(j.CallExpression, {
      callee: { object: { name: 'Promise' }, property: { name: 'coroutine' } },
    })
    .replaceWith(transformToSimpleCall);
  return root.toSource();
};
