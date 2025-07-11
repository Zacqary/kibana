/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { css } from '@emotion/react';
import { i18n } from '@kbn/i18n';
import { monaco, XJsonLang } from '@kbn/monaco';
import { EuiButtonEmpty, EuiCopy, EuiFlexGroup, EuiFlexItem, EuiSpacer } from '@elastic/eui';
import { CodeEditor } from '@kbn/code-editor';

const codeEditorAriaLabel = i18n.translate('unifiedDocViewer.json.codeEditorAriaLabel', {
  defaultMessage: 'Read only JSON view of an elasticsearch document',
});
const copyToClipboardLabel = i18n.translate('unifiedDocViewer.json.copyToClipboardLabel', {
  defaultMessage: 'Copy to clipboard',
});

interface JsonCodeEditorCommonProps {
  jsonValue: string;
  onEditorDidMount: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  width?: string | number;
  height?: string | number;
  hasLineNumbers?: boolean;
  hideCopyButton?: boolean;
  enableFindAction?: boolean;
}

export const JsonCodeEditorCommon = ({
  jsonValue,
  width,
  height,
  hasLineNumbers,
  onEditorDidMount,
  hideCopyButton,
  enableFindAction,
}: JsonCodeEditorCommonProps) => {
  if (jsonValue === '') {
    return null;
  }
  const codeEditor = (
    <CodeEditor
      languageId={XJsonLang.ID}
      width={width}
      height={height}
      value={jsonValue || ''}
      editorDidMount={onEditorDidMount}
      aria-label={codeEditorAriaLabel}
      options={{
        automaticLayout: true,
        fontSize: 12,
        lineNumbers: hasLineNumbers ? 'on' : 'off',
        minimap: {
          enabled: false,
        },
        overviewRulerBorder: false,
        readOnly: true,
        scrollbar: {
          alwaysConsumeMouseWheel: false,
        },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        wrappingIndent: 'indent',
      }}
      enableFindAction={enableFindAction}
    />
  );
  if (hideCopyButton) {
    return codeEditor;
  }
  return (
    <EuiFlexGroup css={styles.codeEditor} direction="column" gutterSize="s">
      <EuiFlexItem>
        <EuiSpacer size="s" />
        <div className="eui-textRight">
          <EuiCopy textToCopy={jsonValue}>
            {(copy) => (
              <EuiButtonEmpty size="xs" flush="right" iconType="copyClipboard" onClick={copy}>
                {copyToClipboardLabel}
              </EuiButtonEmpty>
            )}
          </EuiCopy>
        </div>
      </EuiFlexItem>
      <EuiFlexItem>{codeEditor}</EuiFlexItem>
    </EuiFlexGroup>
  );
};

export const JSONCodeEditorCommonMemoized = React.memo((props: JsonCodeEditorCommonProps) => {
  return <JsonCodeEditorCommon {...props} />;
});

const styles = {
  codeEditor: css`
    height: 100%;
  `,
};
