import React, { Fragment } from 'react';
import { withRouter } from 'react-router-dom';
import { I18n, i18nMark } from '@lingui/react';
import { t } from '@lingui/macro';
import { Button } from '@patternfly/react-core';
import { PlusIcon } from '@patternfly/react-icons';
import PaginatedDataList from '../../../../components/PaginatedDataList';
import OrganizationAccessItem from '../../components/OrganizationAccessItem';
import DeleteRoleConfirmationModal from '../../components/DeleteRoleConfirmationModal';
import AddResourceRole from '../../../../components/AddRole/AddResourceRole';
import { withNetwork } from '../../../../contexts/Network';
import { parseQueryString } from '../../../../util/qs';
import { Organization } from '../../../../types';

const DEFAULT_QUERY_PARAMS = {
  page: 1,
  page_size: 5,
  order_by: 'first_name',
};

class OrganizationAccess extends React.Component {
  static propTypes = {
    organization: Organization.isRequired,
  };

  constructor (props) {
    super(props);

    this.readOrgAccessList = this.readOrgAccessList.bind(this);
    this.confirmRemoveRole = this.confirmRemoveRole.bind(this);
    this.cancelRemoveRole = this.cancelRemoveRole.bind(this);
    this.removeRole = this.removeRole.bind(this);
    this.toggleAddModal = this.toggleAddModal.bind(this);
    this.handleSuccessfulRoleAdd = this.handleSuccessfulRoleAdd.bind(this);

    this.state = {
      isLoading: false,
      isInitialized: false,
      isAddModalOpen: false,
      error: null,
      itemCount: 0,
      accessRecords: [],
      roleToDelete: null,
      roleToDeleteAccessRecord: null,
    };
  }

  componentDidMount () {
    this.readOrgAccessList();
  }

  componentDidUpdate (prevProps) {
    const { location } = this.props;
    if (location !== prevProps.location) {
      this.readOrgAccessList();
    }
  }

  async readOrgAccessList () {
    const { organization, api, handleHttpError } = this.props;
    this.setState({ isLoading: true });
    try {
      const { data } = await api.getOrganizationAccessList(
        organization.id,
        this.getQueryParams()
      );
      this.setState({
        itemCount: data.count || 0,
        accessRecords: data.results || [],
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      handleHttpError(error) || this.setState({
        error,
        isLoading: false,
      });
    }
  }

  getQueryParams () {
    const { location } = this.props;
    const searchParams = parseQueryString(location.search.substring(1));

    return {
      ...DEFAULT_QUERY_PARAMS,
      ...searchParams,
    };
  }

  confirmRemoveRole (role, accessRecord) {
    this.setState({
      roleToDelete: role,
      roleToDeleteAccessRecord: accessRecord,
    });
  }

  cancelRemoveRole () {
    this.setState({
      roleToDelete: null,
      roleToDeleteAccessRecord: null
    });
  }

  async removeRole () {
    const { api, handleHttpError } = this.props;
    const { roleToDelete: role, roleToDeleteAccessRecord: accessRecord } = this.state;
    if (!role || !accessRecord) {
      return;
    }
    const type = typeof role.team_id === 'undefined' ? 'users' : 'teams';
    this.setState({ isLoading: true });
    try {
      if (type === 'teams') {
        await api.disassociateTeamRole(role.team_id, role.id);
      } else {
        await api.disassociateUserRole(accessRecord.id, role.id);
      }
      this.setState({
        isLoading: false,
        roleToDelete: null,
        roleToDeleteAccessRecord: null,
      });
      this.readOrgAccessList();
    } catch (error) {
      handleHttpError(error) || this.setState({
        error,
        isLoading: false,
      });
    }
  }

  toggleAddModal () {
    const { isAddModalOpen } = this.state;
    this.setState({
      isAddModalOpen: !isAddModalOpen,
    });
  }

  handleSuccessfulRoleAdd () {
    this.toggleAddModal();
    this.readOrgAccessList();
  }

  render () {
    const { api, organization } = this.props;
    const {
      isLoading,
      isInitialized,
      itemCount,
      isAddModalOpen,
      accessRecords,
      roleToDelete,
      roleToDeleteAccessRecord,
      error,
    } = this.state;

    const canEdit = organization.summary_fields.user_capabilities.edit;

    if (error) {
      // TODO: better error state
      return <div>{error.message}</div>;
    }
    // TODO: better loading state
    return (
      <Fragment>
        {isLoading && (<div>Loading...</div>)}
        {roleToDelete && (
          <DeleteRoleConfirmationModal
            role={roleToDelete}
            username={roleToDeleteAccessRecord.username}
            onCancel={this.cancelRemoveRole}
            onConfirm={this.removeRole}
          />
        )}
        {isInitialized && (
          <PaginatedDataList
            items={accessRecords}
            itemCount={itemCount}
            itemName="role"
            queryParams={this.getQueryParams()}
            toolbarColumns={[
              { name: i18nMark('Name'), key: 'first_name', isSortable: true },
              { name: i18nMark('Username'), key: 'username', isSortable: true },
              { name: i18nMark('Last Name'), key: 'last_name', isSortable: true },
            ]}
            additionalControls={canEdit ? (
              <I18n>
                {({ i18n }) => (
                  <Button
                    variant="primary"
                    aria-label={i18n._(t`Add Access Role`)}
                    onClick={this.toggleAddModal}
                  >
                    <PlusIcon />
                  </Button>
                )}
              </I18n>
            ) : null}
            renderItem={accessRecord => (
              <OrganizationAccessItem
                key={accessRecord.id}
                accessRecord={accessRecord}
                onRoleDelete={this.confirmRemoveRole}
              />
            )}
          />
        )}
        {isAddModalOpen && (
          <AddResourceRole
            onClose={this.toggleAddModal}
            onSave={this.handleSuccessfulRoleAdd}
            api={api}
            roles={organization.summary_fields.object_roles}
          />
        )}
      </Fragment>
    );
  }
}

export { OrganizationAccess as _OrganizationAccess };
export default withNetwork(withRouter(OrganizationAccess));
