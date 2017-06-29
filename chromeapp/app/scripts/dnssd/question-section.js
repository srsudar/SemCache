'use strict';

const SmartBuffer = require('smart-buffer').SmartBuffer;

const dnsUtil = require('./dns-util');


const MAX_QUERY_TYPE = 65535;
const MAX_QUERY_CLASS = 65535;

/**
 * A DNS Question section.
 */
class QuestionSection {
  /*
   *
   * @param {string} qName the name of the query
   * @param {integer} qType the type of the query
   * @param {integer} qClass the class of the query
   */
  constructor(qName, qType, qClass) {
    if (qType < 0 || qType > MAX_QUERY_TYPE) {
      throw new Error(
        'query type must be > 0 and < ' +
          MAX_QUERY_TYPE +
          ': ' +
          qType
      );
    }

    if (qClass < 0 || qClass > MAX_QUERY_CLASS) {
      throw new Error(
        'query class must be > 0 and < ' +
          MAX_QUERY_CLASS +
          ': ' +
          qClass
      );
    }

    this.queryName = qName;
    this.queryType = qType;
    this.queryClass = qClass;
  }

  /**
   * Convert the QuestionSection to a ByteArray object. According to 'TCP/IP
   * Illustrated, Volume 1' by Stevens, the format of the question section is
   * as follows:
   *
   * variable number of octets representing the query name
   *
   * 2 octets representing the query type
   *
   * 2 octets representing the query class
   *
   * @return {ByteArray}
   */
  toBuffer() {
    let sBuff = new SmartBuffer();
    
    let queryBuff = dnsUtil.getDomainAsBuffer(this.queryName);
    sBuff.writeBuffer(queryBuff);

    // 2 octets
    sBuff.writeUInt16BE(this.queryType);
    sBuff.writeUInt16BE(this.queryClass);

    return sBuff.toBuffer();
  }

  /**
   * Returns true if the question has requested a unicast response, else false.
   *
   * @return {boolean}
   */
  unicastResponseRequested() {
    // For now, since we can't share a port in Chrome, we will assume that
    // unicast responses are always requested.
    return true;
  }

  /**
   * Create a QuestionSection from a SmartBuffer as returned by toBuffer().
   *
   * @param {SmartBuffer} sBuff
   *
   * @return {QuestionSection}
   */
  static fromSmartBuffer(sBuff) {
    let queryName = dnsUtil.getDomainFromSmartBuffer(sBuff);

    // 2 octets
    let queryType = sBuff.readUInt16BE();
    if (queryType < 0 || queryType > MAX_QUERY_TYPE) {
      throw new Error('deserialized query type out of range: ' + queryType);
    }

    let queryClass = sBuff.readUInt16BE();
    if (queryClass < 0 || queryClass > MAX_QUERY_CLASS) {
      throw new Error('deserialized query class out of range: ' + queryClass);
    }

    let result = new QuestionSection(queryName, queryType, queryClass);

    return result;
  }
}

exports.QuestionSection = QuestionSection;
