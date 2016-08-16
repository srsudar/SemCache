'use strict';

var test = require('tape');
var qRec = require('../../../app/scripts/dnssd/question-section');

test('can create a QuestionSection', function(t) {
  var queryName = 'blackhawk.local';
  var queryType = 33;
  var queryClass = 4;
  
  var question = new qRec.QuestionSection(queryName, queryType, queryClass);

  t.equal(question.queryName, queryName);
  t.equal(question.queryType, queryType);
  t.equal(question.queryClass, queryClass);

  t.end();
});

test('can serialize and deserialize a QuestionSection', function(t) {
  var queryName = 'fancy.pantsy.com';
  var queryType = 12;
  var queryClass = 3;
  
  var expected = new qRec.QuestionSection(queryName, queryType, queryClass);

  var byteArr = expected.convertToByteArray();

  var recovered = qRec.createQuestionFromReader(byteArr.getReader());

  t.deepEqual(recovered, expected);

  t.end();
});
