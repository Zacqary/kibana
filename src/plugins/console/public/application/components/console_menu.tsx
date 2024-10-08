/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { Component } from 'react';

import { NotificationsSetup } from '@kbn/core/public';

import { EuiContextMenuPanel, EuiContextMenuItem, EuiPopover, EuiButtonIcon } from '@elastic/eui';

import { FormattedMessage } from '@kbn/i18n-react';
import { i18n } from '@kbn/i18n';

interface Props {
  getCurl: () => Promise<string>;
  getDocumentation: () => Promise<string | null>;
  autoIndent: (ev: React.MouseEvent) => void;
  notifications: NotificationsSetup;
}

interface State {
  isPopoverOpen: boolean;
  curlCode: string;
  curlError: Error | null;
}

export class ConsoleMenu extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      curlCode: '',
      isPopoverOpen: false,
      curlError: null,
    };
  }

  mouseEnter = () => {
    if (this.state.isPopoverOpen) return;
    this.props
      .getCurl()
      .then((text) => {
        this.setState({ curlCode: text, curlError: null });
      })
      .catch((e) => {
        this.setState({ curlError: e });
      });
  };

  async copyAsCurl() {
    const { notifications } = this.props;
    try {
      await this.copyText(this.state.curlCode);
      notifications.toasts.add({
        title: i18n.translate('console.consoleMenu.copyAsCurlMessage', {
          defaultMessage: 'Request copied as cURL',
        }),
      });
    } catch (e) {
      notifications.toasts.addError(e, {
        title: i18n.translate('console.consoleMenu.copyAsCurlFailedMessage', {
          defaultMessage: 'Could not copy request as cURL',
        }),
      });
    }
  }

  async copyText(text: string) {
    if (this.state.curlError) {
      throw this.state.curlError;
    }
    if (window.navigator?.clipboard) {
      await window.navigator.clipboard.writeText(text);
      return;
    }
    throw new Error('Could not copy to clipboard!');
  }

  onButtonClick = () => {
    this.setState((prevState) => ({
      isPopoverOpen: !prevState.isPopoverOpen,
    }));
  };

  closePopover = () => {
    this.setState({
      isPopoverOpen: false,
    });
  };

  openDocs = async () => {
    this.closePopover();
    const documentation = await this.props.getDocumentation();
    if (!documentation) {
      return;
    }
    window.open(documentation, '_blank');
  };

  autoIndent = (event: React.MouseEvent) => {
    this.closePopover();
    this.props.autoIndent(event);
  };

  render() {
    const button = (
      <EuiButtonIcon
        onClick={this.onButtonClick}
        data-test-subj="toggleConsoleMenu"
        aria-label={i18n.translate('console.requestOptionsButtonAriaLabel', {
          defaultMessage: 'Request options',
        })}
        iconType="boxesVertical"
        iconSize="s"
      />
    );

    const items = [
      <EuiContextMenuItem
        key="Copy as cURL"
        data-test-subj="consoleMenuCopyAsCurl"
        id="ConCopyAsCurl"
        disabled={!window.navigator?.clipboard}
        onClick={() => {
          this.closePopover();
          this.copyAsCurl();
        }}
        icon="copyClipboard"
      >
        <FormattedMessage
          id="console.requestOptions.copyAsUrlButtonLabel"
          defaultMessage="Copy cURL command"
        />
      </EuiContextMenuItem>,
      <EuiContextMenuItem
        data-test-subj="consoleMenuAutoIndent"
        key="Auto indent"
        onClick={this.autoIndent}
        icon="arrowEnd"
      >
        <FormattedMessage
          id="console.requestOptions.autoIndentButtonLabel"
          defaultMessage="Apply indentations"
        />
      </EuiContextMenuItem>,
      <EuiContextMenuItem
        key="Open documentation"
        data-test-subj="consoleMenuOpenDocs"
        onClick={() => {
          this.openDocs();
        }}
        icon="documentation"
      >
        <FormattedMessage
          id="console.requestOptions.openDocumentationButtonLabel"
          defaultMessage="View documentation"
        />
      </EuiContextMenuItem>,
    ];

    return (
      <span onMouseEnter={this.mouseEnter}>
        <EuiPopover
          id="contextMenu"
          button={button}
          isOpen={this.state.isPopoverOpen}
          closePopover={this.closePopover}
          panelPaddingSize="none"
          anchorPosition="downLeft"
        >
          <EuiContextMenuPanel items={items} data-test-subj="consoleMenu" />
        </EuiPopover>
      </span>
    );
  }
}
