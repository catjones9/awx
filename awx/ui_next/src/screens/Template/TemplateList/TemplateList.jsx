import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import { withI18n } from '@lingui/react';
import { t } from '@lingui/macro';
import {
  Card,
  PageSection,
  PageSectionVariants,
  Dropdown,
  DropdownItem,
  DropdownToggle,
  DropdownPosition,
} from '@patternfly/react-core';

import { QuestionCircleIcon } from '@patternfly/react-icons';
import {
  JobTemplatesAPI,
  UnifiedJobTemplatesAPI,
  WorkflowJobTemplatesAPI
} from '@api';
import AlertModal from '@components/AlertModal';
import DatalistToolbar from '@components/DataListToolbar';
import ErrorDetail from '@components/ErrorDetail';
import PaginatedDataList, {
  ToolbarDeleteButton,
  ToolbarAddButton
} from '@components/PaginatedDataList';
import { getQSConfig, parseNamespacedQueryString } from '@util/qs';

import TemplateListItem from './TemplateListItem';

// The type value in const QS_CONFIG below does not have a space between job_template and
// workflow_job_template so the params sent to the API match what the api expects.
const QS_CONFIG = getQSConfig('template', {
  page: 1,
  page_size: 5,
  order_by: 'name',
  type: 'job_template,workflow_job_template'
});

class TemplatesList extends Component {
  constructor (props) {
    super(props);

    this.state = {
      hasContentLoading: true,
      contentError: null,
      deletionError: null,
      selected: [],
      templates: [],
      itemCount: 0,
      isAddOpen: false,
      nothing: 0
    };
    this.loadTemplates = this.loadTemplates.bind(this);
    this.handleSelectAll = this.handleSelectAll.bind(this);
    this.handleSelect = this.handleSelect.bind(this);
    this.handleTemplateDelete = this.handleTemplateDelete.bind(this);
    this.handleDeleteErrorClose = this.handleDeleteErrorClose.bind(this);
    this.handleAddSelect = this.handleAddSelect.bind(this);
    this.handleAddToggle = this.handleAddToggle.bind(this);
    this.nothing = this.nothing.bind(this);

  }

  componentDidMount () {
    this.loadTemplates();
  }

  componentDidUpdate (prevProps) {
    const { location } = this.props;
    if (location !== prevProps.location) {
      this.loadOrganizations();
    }
    const { selected, deleted, itemCount } = this.state;

    if (selected.length > 0 && deleted) {
      this.state.itemCount = itemCount - selected.length;
      this.state.deleted = false;
    }
  }

  handleDeleteErrorClose () {
    this.setState({ deletionError: null });
  }

  nothing () {
    console.warn(this.state.nothing);
  }
  handleAddToggle () {
    const { isAddOpen } = this.state;

    this.setState({ isAddOpen: !isAddOpen });
  }

  handleAddSelect (isOpen) {
    this.setState({ isAddOpen: isOpen });
  }

  handleSelectAll (isSelected) {
    const { templates } = this.state;
    const selected = isSelected ? [...templates] : [];
    this.setState({ selected });
  }

  handleSelect (template) {
    const { selected } = this.state;
    if (selected.some(s => s.id === template.id)) {
      this.setState({ selected: selected.filter(s => s.id !== template.id) });
    } else {
      this.setState({ selected: selected.concat(template) });
    }
  }

  async handleTemplateDelete () {
    const { selected } = this.state;

    this.setState({ hasContentLoading: true });
    try {
      await Promise.all(selected.map(({ type, id }) => {
        let deletePromise;
        if (type === 'job_template') {
          deletePromise = JobTemplatesAPI.destroy(id);
        } else if (type === 'workflow_job_template') {
          deletePromise = WorkflowJobTemplatesAPI.destroy(id);
        }
        return deletePromise;
      }));
    } catch (err) {
      this.setState({ deletionError: err });
    } finally {
      await this.loadTemplates();
    }
  }

  async loadTemplates () {
    const { location } = this.props;
    const params = parseNamespacedQueryString(QS_CONFIG, location.search);

    this.setState({ contentError: null, hasContentLoading: true });
    try {
      const { data: { count, results } } = await UnifiedJobTemplatesAPI.read(params);
      this.setState({
        itemCount: count,
        templates: results,
        selected: [],
      });
    } catch (err) {
      this.setState({ contentError: err });
    } finally {
      this.setState({ hasContentLoading: false });
    }
  }

  render () {
    const {
      contentError,
      hasContentLoading,
      deletionError,
      templates,
      itemCount,
      selected,
      isAddOpen,
      isOpen
    } = this.state;
    const {
      match,
      i18n
    } = this.props;

    const isAllSelected = selected.length === templates.length;
    const { medium } = PageSectionVariants;
    return (
      <PageSection variant={medium}>
        <Card>
          <PaginatedDataList
            error={contentError}
            hasContentLoading={hasContentLoading}
            items={templates}
            itemCount={itemCount}
            itemName={i18n._(t`Template`)}
            qsConfig={QS_CONFIG}
            toolbarColumns={[
              { name: i18n._(t`Name`), key: 'name', isSortable: true },
              { name: i18n._(t`Modified`), key: 'modified', isSortable: true, isNumeric: true },
              { name: i18n._(t`Created`), key: 'created', isSortable: true, isNumeric: true },
            ]}
            renderToolbar={(props) => (
              <DatalistToolbar
                {...props}
                showSelectAll
                showExpandCollapse
                isAllSelected={isAllSelected}
                onSelectAll={this.handleSelectAll}
                additionalControls={[
                  <ToolbarDeleteButton
                    key="delete"
                    onDelete={this.handleTemplateDelete}
                    itemsToDelete={selected}
                    itemName={i18n._(t`Template`)}
                  />,
                  <Dropdown
                    isPlain
                    isOpen={isAddOpen}
                    position={DropdownPosition.right}
                    onSelect={this.handleAddSelect}
                    toggle={(
                      <DropdownToggle iconComponent={null} onToggle={this.handleAddToggle}>
                        <ToolbarAddButton key="add" onToggle={this.handleAddToggle} onClick={this.nothing}/>
                      </DropdownToggle>
                    )}
                    dropdownItems={[
                      <DropdownItem key="job">
                        {i18n._(t`Job Template`)}
                      </DropdownItem>,
                      <DropdownItem key="workflow">
                        {i18n._(t`Workflow Template`)}
                      </DropdownItem>
                      ]}
                    >
                </Dropdown>
                ]}
              />
            )}
            renderItem={(template) => (
              <TemplateListItem
                key={template.id}
                value={template.name}
                template={template}
                detailUrl={`${match.url}/${template.type}/${template.id}`}
                onSelect={() => this.handleSelect(template)}
                isSelected={selected.some(row => row.id === template.id)}
              />
            )}
          />
        </Card>
        <AlertModal
          isOpen={deletionError}
          variant="danger"
          title={i18n._(t`Error!`)}
          onClose={this.handleDeleteErrorClose}
        >
          {i18n._(t`Failed to delete one or more template.`)}
          <ErrorDetail error={deletionError} />
        </AlertModal>
      </PageSection>
    );
  }
}

export { TemplatesList as _TemplatesList };
export default withI18n()(withRouter(TemplatesList));
