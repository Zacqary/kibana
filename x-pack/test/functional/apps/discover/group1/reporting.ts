/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import moment, { DurationInputArg2 } from 'moment';
import { Key } from 'selenium-webdriver';
import { FtrProviderContext } from '../../../ftr_provider_context';

export default function ({ getService, getPageObjects }: FtrProviderContext) {
  const reportingAPI = getService('reporting');
  const log = getService('log');
  const es = getService('es');
  const esArchiver = getService('esArchiver');
  const kibanaServer = getService('kibanaServer');
  const browser = getService('browser');
  const retry = getService('retry');
  const { reporting, common, discover, timePicker, header, exports } = getPageObjects([
    'reporting',
    'common',
    'discover',
    'timePicker',
    'share',
    'exports',
    'header',
  ]);
  const monacoEditor = getService('monacoEditor');
  const filterBar = getService('filterBar');
  const testSubjects = getService('testSubjects');
  const toasts = getService('toasts');

  const deleteIndex = async (index: string) => {
    try {
      await es.indices.delete({ index });
    } catch (err) {
      // ignore 404 error
    }
  };

  const createDocs = async ({
    index,
    endDate,
    docCount,
    dateSubstractUnit,
    addNumberField,
  }: {
    index: string;
    endDate: string;
    docCount: number;
    dateSubstractUnit?: DurationInputArg2;
    addNumberField?: boolean;
  }) => {
    interface TestDoc {
      timestamp: string;
      name: string;
      updated_at?: string;
      numberValue?: number;
    }

    const docs = Array<TestDoc>(docCount);

    for (let i = 0; i <= docs.length - 1; i++) {
      const name = `test-${i + 1}`;
      const timestamp = moment
        .utc(endDate)
        .subtract(docCount - i, dateSubstractUnit ?? 'days')
        .format();

      const commonFields: Pick<TestDoc, 'timestamp' | 'name' | 'numberValue'> = {
        timestamp,
        name,
      };

      if (addNumberField) {
        commonFields.numberValue = i;
      }

      if (i === 0) {
        // only the oldest document has a value for updated_at
        docs[i] = {
          ...commonFields,
          updated_at: moment.utc(endDate).format(),
        };
      } else {
        // updated_at field does not exist in first 500 documents
        docs[i] = commonFields;
      }
    }

    const res = await es.bulk({
      index,
      operations: docs.map((d) => `{"index": {}}\n${JSON.stringify(d)}\n`),
    });

    log.info(`Indexed ${res.items.length} test data docs into ${index}.`);
  };

  const getReport = async ({ timeout } = { timeout: 60 * 1000 }) => {
    // close any open notification toasts
    await toasts.dismissAll();

    await exports.clickExportTopNavButton();
    await reporting.selectExportItem('CSV');
    await reporting.clickGenerateReportButton();
    await exports.closeExportFlyout();
    await exports.clickExportTopNavButton();

    const url = await reporting.getReportURL(timeout);
    const res = await reporting.getResponse(url ?? '');

    expect(res.status).to.equal(200);
    expect(res.get('content-type')).to.equal('text/csv; charset=utf-8');
    return res;
  };

  const getReportPostUrl = async () => {
    // click 'Copy POST URL'
    await exports.clickExportTopNavButton();
    await reporting.selectExportItem('CSV');
    await reporting.clickGenerateReportButton();
    await reporting.copyReportingPOSTURLValueToClipboard();

    const clipboardValue = decodeURIComponent(await browser.getClipboardValue());

    await exports.closeExportFlyout();

    return clipboardValue;
  };

  describe('Discover CSV Export', () => {
    describe('Check Available', () => {
      before(async () => {
        await esArchiver.emptyKibanaIndex();
        await reportingAPI.initEcommerce();
        await common.navigateToApp('discover');
        await discover.selectIndexPattern('ecommerce');
      });

      after(async () => {
        await reportingAPI.teardownEcommerce();
        await esArchiver.emptyKibanaIndex();
      });

      it('is available if new', async () => {
        await reporting.openExportPopover();
        expect(await exports.isPopoverItemEnabled('CSV')).to.be(true);
        await reporting.openExportPopover();
      });

      it('becomes available when saved', async () => {
        await discover.saveSearch('my search - expectEnabledGenerateReportButton');
        await reporting.openExportPopover();
        expect(await exports.isPopoverItemEnabled('CSV')).to.be(true);
        await reporting.openExportPopover();
      });
    });

    describe('Generate CSV: new search', () => {
      before(async () => {
        await reportingAPI.initEcommerce();
        /**
         *  Important: `esArchiver.emptyKibanaIndex()` above also resets the
         * Kibana time zone setting, so we're re-applying it here.
         * The serverless version of the test uses
         * `kibanaServer.savedObjects.cleanStandardList` instead,
         * which does not reset the time zone setting,
         * so we don't need to re-apply it in these tests.
         */
        await kibanaServer.uiSettings.update({ 'dateFormat:tz': 'UTC' });
      });

      after(async () => {
        await reportingAPI.teardownEcommerce();
        await esArchiver.emptyKibanaIndex();
      });

      beforeEach(async () => {
        await common.navigateToApp('discover');
        await discover.selectIndexPattern('ecommerce');
      });

      it('generates a report with single timefilter', async () => {
        await discover.clickNewSearchButton();
        await timePicker.setCommonlyUsedTime('Last_24 hours');
        await discover.saveSearch('single-timefilter-search');

        // get shared URL value
        const sharedURL = await browser.getCurrentUrl();

        const reportURL = await getReportPostUrl();

        // get number of filters in URLs
        const timeFiltersNumberInReportURL =
          reportURL.split('query:(range:(order_date:(format:strict_date_optional_time').length - 1;
        const timeFiltersNumberInSharedURL = sharedURL.split('time:').length - 1;

        expect(timeFiltersNumberInSharedURL).to.be(1);
        expect(sharedURL.includes('time:(from:now-24h%2Fh,to:now))')).to.be(true);

        expect(timeFiltersNumberInReportURL).to.be(1);

        expect(
          reportURL.includes(
            `query:(range:(order_date:(format:strict_date_optional_time,gte:now-24h/h,lte:now))))`
          )
        ).to.be(true);

        // return keyboard state
        await browser.getActions().keyUp(Key.CONTROL).perform();
        await browser.getActions().keyUp('v').perform();
      });

      it('generates a report from a new search with data: default', async () => {
        await discover.clickNewSearchButton();
        await reporting.setTimepickerInEcommerceDataRange();

        await discover.saveSearch('my search - with data - expectReportCanBeCreated');

        const res = await getReport();
        expect(res.status).to.equal(200);
        expect(res.get('content-type')).to.equal('text/csv; charset=utf-8');

        const csvFile = res.text;
        expectSnapshot(csvFile).toMatch();
      });

      it('generates a report with no data', async () => {
        await reporting.setTimepickerInEcommerceNoDataRange();
        await discover.saveSearch('my search - no data - expectReportCanBeCreated');

        const res = await getReport();
        expect(res.text).to.be(`\n`);
      });

      it('generates a large export', async () => {
        const fromTime = 'Apr 27, 2019 @ 23:56:51.374';
        const toTime = 'Aug 23, 2019 @ 16:18:51.821';
        await timePicker.setAbsoluteRange(fromTime, toTime);
        await discover.clickNewSearchButton();
        await retry.try(async () => {
          expect(await discover.getHitCount()).to.equal('4,675');
        });
        await discover.saveSearch('large export');

        // match file length, the beginning and the end of the csv file contents
        const { text: csvFile } = await getReport({ timeout: 80 * 1000 });
        expect(csvFile.length).to.be(4845684);
        expectSnapshot(csvFile.slice(0, 5000)).toMatch();
        expectSnapshot(csvFile.slice(-5000)).toMatch();
      });

      it('generate a report using ES|QL', async () => {
        await discover.selectTextBaseLang();
        const testQuery = `from ecommerce | STATS total_sales = SUM(taxful_total_price) BY day_of_week |  SORT total_sales DESC`;

        await monacoEditor.setCodeEditorValue(testQuery);
        await testSubjects.click('querySubmitButton');
        await header.waitUntilLoadingHasFinished();

        const res = await getReport();
        expect(res.status).to.equal(200);
        expect(res.get('content-type')).to.equal('text/csv; charset=utf-8');

        const csvFile = res.text;
        expectSnapshot(csvFile).toMatch();
      });

      // TODO: Adjust and unskip when we have full support for toggling relative/absolute time ranges through the export UI
      // https://github.com/elastic/kibana/issues/223171
      it.skip('generate a report using ES|QL for relative time range as absolute dates and time params', async () => {
        const RECENT_DATA_INDEX_NAME = 'test_recent_data';
        const RECENT_DOC_COUNT = 500;
        const RECENT_DOC_END_DATE = moment().toISOString();

        await deleteIndex(RECENT_DATA_INDEX_NAME);
        await createDocs({
          index: RECENT_DATA_INDEX_NAME,
          endDate: RECENT_DOC_END_DATE,
          docCount: RECENT_DOC_COUNT,
          dateSubstractUnit: 'minutes',
          addNumberField: true,
        });

        await timePicker.setCommonlyUsedTime('Last_15 minutes');
        await discover.selectTextBaseLang();
        await header.waitUntilLoadingHasFinished();
        await discover.waitUntilSearchingHasFinished();

        const testQuery = `from ${RECENT_DATA_INDEX_NAME} | sort timestamp | WHERE timestamp >= ?_tstart AND timestamp <= ?_tend | KEEP name, numberValue`;
        await monacoEditor.setCodeEditorValue(testQuery);
        await testSubjects.click('querySubmitButton');
        await header.waitUntilLoadingHasFinished();
        await discover.waitUntilSearchingHasFinished();

        const reportPostUrl = await getReportPostUrl();
        expect(reportPostUrl).to.contain(`timeRange:(from:'2`); // not `from:now-15m`
        expect(reportPostUrl).to.contain(`filters:!()`);
        expect(reportPostUrl).to.contain(`query:(esql:'${testQuery}')`);

        const res = await getReport();
        expect(res.status).to.equal(200);
        expect(res.get('content-type')).to.equal('text/csv; charset=utf-8');

        const csvFile = res.text;
        expectSnapshot(csvFile).toMatch();

        await deleteIndex(RECENT_DATA_INDEX_NAME);
      });
    });

    describe('Generate CSV: sparse data', () => {
      const TEST_INDEX_NAME = 'sparse_data';
      const TEST_DOC_COUNT = 510;
      const TEST_DOC_END_DATE = '2006-08-14T00:00:00';

      before(async () => {
        await deleteIndex(TEST_INDEX_NAME);
        await createDocs({
          index: TEST_INDEX_NAME,
          endDate: TEST_DOC_END_DATE,
          docCount: TEST_DOC_COUNT,
          dateSubstractUnit: 'days',
        });
        await reportingAPI.initLogs();
        await common.navigateToApp('discover');
        await discover.loadSavedSearch('Sparse Columns');
      });

      after(async () => {
        await reportingAPI.teardownLogs();
        await deleteIndex(TEST_INDEX_NAME);
      });

      beforeEach(async () => {
        const fromTime = 'Jan 10, 2005 @ 00:00:00.000';
        const toTime = 'Dec 23, 2006 @ 00:00:00.000';
        await timePicker.setAbsoluteRange(fromTime, toTime);
        await retry.try(async () => {
          expect(await discover.getHitCount()).to.equal(TEST_DOC_COUNT.toString());
        });
      });

      it(`handles field formatting for a field that doesn't exist initially`, async () => {
        const res = await getReport();
        expect(res.status).to.equal(200);
        expect(res.get('content-type')).to.equal('text/csv; charset=utf-8');

        const csvFile = res.text;
        expectSnapshot(csvFile).toMatch();
      });
    });

    describe('Generate CSV: archived search', () => {
      const setupPage = async () => {
        const fromTime = 'Jun 22, 2019 @ 00:00:00.000';
        const toTime = 'Jun 26, 2019 @ 23:30:00.000';
        await timePicker.setAbsoluteRange(fromTime, toTime);
      };

      before(async () => {
        await reportingAPI.initEcommerce();
        await common.navigateToApp('discover');
        await discover.selectIndexPattern('ecommerce');
      });

      after(async () => {
        await reportingAPI.teardownEcommerce();
      });

      beforeEach(async () => {
        await setupPage();
      });

      afterEach(async () => {
        await reporting.checkForReportingToasts();
      });

      it('generates a report with data', async () => {
        await discover.loadSavedSearch('Ecommerce Data');
        await retry.try(async () => {
          expect(await discover.getHitCount()).to.equal('740');
        });

        const { text: csvFile } = await getReport();
        expectSnapshot(csvFile).toMatch();
      });

      it('generates a report with filtered data', async () => {
        await discover.loadSavedSearch('Ecommerce Data');
        await retry.try(async () => {
          expect(await discover.getHitCount()).to.equal('740');
        });

        // filter
        await filterBar.addFilter({ field: 'category', operation: 'is', value: `Men's Shoes` });
        await retry.try(async () => {
          expect(await discover.getHitCount()).to.equal('154');
        });

        const { text: csvFile } = await getReport();
        expectSnapshot(csvFile).toMatch();
      });
    });
  });
}
