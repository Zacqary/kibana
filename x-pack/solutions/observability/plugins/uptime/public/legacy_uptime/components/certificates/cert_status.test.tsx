/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
// Necessary until components being tested are migrated of styled-components https://github.com/elastic/kibana/issues/219037
import 'jest-styled-components';
import { renderWithRouter, shallowWithRouter } from '../../lib';
import { CertStatus } from './cert_status';
import * as redux from 'react-redux';
import moment from 'moment';

describe('CertStatus', () => {
  beforeEach(() => {
    const spy = jest.spyOn(redux, 'useDispatch');
    spy.mockReturnValue(jest.fn());

    const spy1 = jest.spyOn(redux, 'useSelector');
    spy1.mockReturnValue(true);
  });

  const cert = {
    monitors: [{ name: '', id: 'github', url: 'https://github.com/' }],
    not_after: '2020-05-08T00:00:00.000Z',
    not_before: '2018-05-08T00:00:00.000Z',
    issuer: 'DigiCert SHA2 Extended Validation Server CA',
    sha1: 'ca06f56b258b7a0d4f2b05470939478651151984',
    sha256: '3111500c4a66012cdae333ec3fca1c9dde45c954440e7ee413716bff3663c074',
    common_name: 'github.com',
  };

  it('shallow renders expected elements for valid props', () => {
    // dive() removes all unnecessary React-Router wrapping elements
    expect(shallowWithRouter(<CertStatus cert={cert} />).dive()).toMatchSnapshot();
  });

  it('renders expected elements for valid props', () => {
    cert.not_after = moment().add('4', 'months').toISOString();
    expect(renderWithRouter(<CertStatus cert={cert} />)).toMatchSnapshot();
  });
});
