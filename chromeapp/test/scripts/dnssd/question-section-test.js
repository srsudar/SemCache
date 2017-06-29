'use strict';

const test = require('tape');

const SmartBuffer = require('smart-buffer').SmartBuffer;

let qRec = require('../../../app/scripts/dnssd/question-section');
let QuestionSection = qRec.QuestionSection;


test('can create a QuestionSection', function(t) {
  let queryName = 'blackhawk.local';
  let queryType = 33;
  let queryClass = 4;
  
  let question = new QuestionSection(queryName, queryType, queryClass);

  t.equal(question.queryName, queryName);
  t.equal(question.queryType, queryType);
  t.equal(question.queryClass, queryClass);

  t.end();
});

test('can serialize and deserialize a QuestionSection', function(t) {
  let queryName = 'fancy.pantsy.com';
  let queryType = 12;
  let queryClass = 3;
  
  let expected = new QuestionSection(queryName, queryType, queryClass);

  let buff = expected.toBuffer();

  let recovered = QuestionSection.fromSmartBuffer(
    SmartBuffer.fromBuffer(buff)
  );

  t.deepEqual(recovered, expected);

  t.end();
});
