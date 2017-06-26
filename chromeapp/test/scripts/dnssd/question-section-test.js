'use strict';

const test = require('tape');

let qRec = require('../../../app/scripts/dnssd/question-section');


test('can create a QuestionSection', function(t) {
  let queryName = 'blackhawk.local';
  let queryType = 33;
  let queryClass = 4;
  
  let question = new qRec.QuestionSection(queryName, queryType, queryClass);

  t.equal(question.queryName, queryName);
  t.equal(question.queryType, queryType);
  t.equal(question.queryClass, queryClass);

  t.end();
});

test('can serialize and deserialize a QuestionSection', function(t) {
  let queryName = 'fancy.pantsy.com';
  let queryType = 12;
  let queryClass = 3;
  
  let expected = new qRec.QuestionSection(queryName, queryType, queryClass);

  let byteArr = expected.convertToByteArray();

  let recovered = qRec.createQuestionFromReader(byteArr.getReader());

  t.deepEqual(recovered, expected);

  t.end();
});
