// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import axios from 'axios';
import { SubscriptionClient } from '@azure/arm-subscriptions';
import { Subscription } from '@azure/arm-subscriptions/esm/models';
import { ResourceManagementClient } from '@azure/arm-resources';
import { ResourceGroup, GenericResource } from '@azure/arm-resources/esm/models';
import { AzureBotService } from '@azure/arm-botservice';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ResourceNameAvailability, GlobalCsmSkuDescription } from '@azure/arm-appservice/esm/models';
import { CheckNameAvailabilityResponseBody } from '@azure/arm-botservice/esm/models';
import { CognitiveServicesManagementClient } from '@azure/arm-cognitiveservices';
import { CognitiveServicesResourceAndSku } from '@azure/arm-cognitiveservices/esm/models';
import { TokenCredentials } from '@azure/ms-rest-js';
import debug from 'debug';

import * as Images from './images';
import { AzureAPIStatus, AzureResourceProviderType } from './types';

const logger = debug('composer:extension:azureProvision');

export const getSubscriptions = async (token: string): Promise<Array<Subscription>> => {
  const tokenCredentials = new TokenCredentials(token);
  try {
    const subscriptionClient = new SubscriptionClient(tokenCredentials);
    const subscriptionsResult = await subscriptionClient.subscriptions.list();
    if (subscriptionsResult._response.status >= 300) {
      logger({
        status: AzureAPIStatus.ERROR,
        message: subscriptionsResult._response.bodyAsText,
      });
      return [];
    }
    console.log('successfully loaded subscriptions');
    return subscriptionsResult._response.parsedBody;
  } catch (err) {
    logger({
      status: AzureAPIStatus.ERROR,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    });
    return [];
  }
};

export const getResourceGroups = async (token: string, subscriptionId: string): Promise<Array<ResourceGroup>> => {
  try {
    if (!subscriptionId) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need subscription or subscription id as a parameter.',
      });
      return [];
    }
    const tokenCredentials = new TokenCredentials(token);
    const resourceManagementClient = new ResourceManagementClient(tokenCredentials, subscriptionId);
    const resourceGroupsResult = await resourceManagementClient.resourceGroups.list();
    if (resourceGroupsResult._response.status >= 300) {
      logger({
        status: AzureAPIStatus.ERROR,
        message: resourceGroupsResult._response.bodyAsText,
      });
      return [];
    }
    return resourceGroupsResult._response.parsedBody;
  } catch (err) {
    logger({
      status: AzureAPIStatus.ERROR,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    });
    return [];
  }
};

/**
 *  get resources by resource group
 */
export const getResources = async (
  token: string,
  subscriptionId: string,
  resourceGroupName: string
): Promise<Array<GenericResource>> => {
  try {
    if (!subscriptionId) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need subscription or subscription id as a parameter.',
      });
      return [];
    }
    if (!resourceGroupName) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need resource group name as a parameter.',
      });
      return [];
    }
    const tokenCredentials = new TokenCredentials(token);
    const resourceManagementClient = new ResourceManagementClient(tokenCredentials, subscriptionId);
    const listByResourceGroupResult = await resourceManagementClient.resources.listByResourceGroup(resourceGroupName);
    if (listByResourceGroupResult._response.status >= 300) {
      logger({
        status: AzureAPIStatus.ERROR,
        message: listByResourceGroupResult._response.bodyAsText,
      });
      return [];
    }
    return listByResourceGroupResult._response.parsedBody;
  } catch (err) {
    logger({
      status: AzureAPIStatus.ERROR,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    });
    return [];
  }
};

export const getDeployLocations = async (token: string, subscriptionId: string) => {
  try {
    console.log(token);
    const result = await axios.get(
      `https://management.azure.com/subscriptions/${subscriptionId}/locations?api-version=2019-10-01`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log(result.data);
    return result.data.value;
  } catch (error) {
    console.log(error.response.data);
    // popup window to login
    if (error.response.data.redirectUri) {
      // await loginPopup();
      // TODO: Fix this
      alert('NOT LOGGED IN');
    }
  }
};

export const GetSupportedRegionsByType = async (
  token: string,
  subscriptionId: string,
  resourceType: AzureResourceProviderType
): Promise<Array<string>> => {
  try {
    if (!subscriptionId) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need subscription or subscription id as a parameter.',
      });
      return [];
    }

    if (!resourceType) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need resourceType or as a parameter.',
      });
      return [];
    }
    const credentials = new TokenCredentials(token);
    const resourceManagementClient = new ResourceManagementClient(credentials, subscriptionId);
    const resourceProviderResult = await resourceManagementClient.providers.get(resourceType);
    if (resourceProviderResult._response.status >= 300) {
      logger({
        status: AzureAPIStatus.ERROR,
        message: resourceProviderResult._response.bodyAsText,
      });
      return [];
    }
    const resourceTypes = resourceProviderResult._response.parsedBody.resourceTypes;
    if (!resourceTypes || resourceTypes.length == 0) {
      return [];
    }
    return resourceTypes[0].locations ?? [];
  } catch (err) {
    logger({
      status: AzureAPIStatus.ERROR,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    });
    return [];
  }
};

/**
 * Check bot channel registration name availability
 */
export const CheckBotNameAvailability = async (
  token: string,
  botName: string,
  subscriptionId: string
): Promise<CheckNameAvailabilityResponseBody> => {
  try {
    if (!botName) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need bot name as a parameter.',
      });
      return {
        valid: false,
        message: 'Invalid param: bot name',
      } as CheckNameAvailabilityResponseBody;
    }
    if (!subscriptionId) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need subscription id as a parameter.',
      });
      return {
        valid: false,
        message: 'Invalid param: subscription id',
      } as CheckNameAvailabilityResponseBody;
    }
    const credentials = new TokenCredentials(token);
    const azureBotService = new AzureBotService(credentials, subscriptionId);
    const getCheckNameAvailabilityResult = await azureBotService.bots.getCheckNameAvailability({
      name: botName,
      type: 'bot',
    });
    if (getCheckNameAvailabilityResult._response.status >= 300) {
      logger({
        status: AzureAPIStatus.ERROR,
        message: getCheckNameAvailabilityResult._response.bodyAsText,
      });
      return {
        valid: false,
        message: `Invalid request: ${getCheckNameAvailabilityResult._response.bodyAsText}`,
      } as CheckNameAvailabilityResponseBody;
    }
    return getCheckNameAvailabilityResult._response.parsedBody;
  } catch (err) {
    logger({
      status: AzureAPIStatus.ERROR,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    });
    return {
      valid: false,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    } as CheckNameAvailabilityResponseBody;
  }
};

/**
 * Check the web app name availability
 */
export const CheckWebAppNameAvailability = async (
  token: string,
  webAppName: string,
  subscriptionId: string
): Promise<ResourceNameAvailability> => {
  try {
    if (!webAppName) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need webapp name as a parameter.',
      });
      return {
        nameAvailable: false,
        message: 'Invalid param: webapp name',
      } as ResourceNameAvailability;
    }
    if (!subscriptionId) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need subscription id as a parameter.',
      });
      return {
        nameAvailable: false,
        message: 'Invalid param: subscription id',
      } as ResourceNameAvailability;
    }
    const credentials = new TokenCredentials(token);
    const webSiteManagementClient = new WebSiteManagementClient(credentials, subscriptionId);
    const getCheckNameAvailabilityResult = await webSiteManagementClient.checkNameAvailability(
      name,
      'Microsoft.Web/sites'
    );
    if (getCheckNameAvailabilityResult._response.status >= 300) {
      logger({
        status: AzureAPIStatus.ERROR,
        message: getCheckNameAvailabilityResult._response.bodyAsText,
      });
      return {
        nameAvailable: false,
        message: `Invalid request: ${getCheckNameAvailabilityResult._response.bodyAsText}`,
      } as ResourceNameAvailability;
    }
    return getCheckNameAvailabilityResult._response.parsedBody;
  } catch (err) {
    logger({
      status: AzureAPIStatus.ERROR,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    });
    return {
      nameAvailable: false,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    } as ResourceNameAvailability;
  }
};

/**
 * Check sku availability for cognitive resources
 */
export const CheckCognitiveResourceSku = async (
  token: string,
  subscriptionId: string,
  location: string,
  sku: string,
  kind: string,
  type: string
): Promise<boolean> => {
  try {
    if (!subscriptionId) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need subscription or subscription id as a parameter.',
      });
      return false;
    }
    if (!location) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need location as a parameter.',
      });
      return false;
    }
    if (!sku) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need sku as a parameter.',
      });
      return false;
    }
    if (!kind) {
      logger({
        status: AzureAPIStatus.PARAM_ERROR,
        message: 'Need subscription or subscription id as a parameter.',
      });
      return false;
    }
    if (!type) {
      type = 'Microsoft.CognitiveServices/accounts';
    }
    const credentials = new TokenCredentials(token);
    const cognitiveServicesManagementClient = new CognitiveServicesManagementClient(credentials, subscriptionId);
    const checkSkuResuilt = await cognitiveServicesManagementClient.checkSkuAvailability(location, [sku], kind, type);
    if (checkSkuResuilt._response.status >= 300) {
      logger({
        status: AzureAPIStatus.ERROR,
        message: checkSkuResuilt._response.bodyAsText,
      });
      return false;
    }
    if (!checkSkuResuilt._response.parsedBody.value || checkSkuResuilt._response.parsedBody.value.length === 0) {
      logger({
        status: AzureAPIStatus.ERROR,
        message: 'Check cognitive resource sku result array is empty.',
      });
      return false;
    }
    return checkSkuResuilt._response.parsedBody.value[0].skuAvailable ?? false;
  } catch (err) {
    logger({
      status: AzureAPIStatus.ERROR,
      message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
    });
    return false;
  }
};

export const getResourceList = async (projectId: string, type: string) => {
  try {
    const result = await axios.get(`/api/provision/${projectId}/${type}/resources`);
    return result.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

/**
 * Get preview and description of resources
 */
export const getPreview = (hostname: string) => {
  const azureWebAppName = `${hostname}`;
  const azureServicePlanName = `${hostname}`;
  const botServiceName = `${hostname}`;
  const cosmosDbName = hostname.replace(/_/g, '').substr(0, 31).toLowerCase();
  const blobStorageName = hostname.toLowerCase().replace(/-/g, '').replace(/_/g, '');
  const luisResourceName = `${hostname}-luis`;
  const luisAuthoringName = `${hostname}-luis-authoring`;
  const qnaAccountName = `${hostname}-qna`;
  const applicationInsightsName = `${hostname}`;

  const previewList = [
    {
      name: azureWebAppName,
      icon: Images.AppService,
      key: 'webApp',
    },
    {
      name: 'Microsoft Application Registration',
      icon: Images.AppRegistration,
      key: 'appRegistration',
    },
    {
      name: botServiceName,
      icon: Images.BotServices,
      key: 'botRegistration',
    },
    {
      name: azureWebAppName,
      icon: Images.FunctionApp,
      key: 'azureFunctions',
    },
    {
      name: cosmosDbName,
      icon: Images.AzureCosmosDb,
      key: 'cosmosDb',
    },
    {
      name: blobStorageName,
      icon: Images.BlobStorage,
      key: 'blobStorage',
    },
    {
      name: applicationInsightsName,
      icon: Images.AppInsights,
      key: 'applicationInsights',
    },
    {
      name: luisAuthoringName,
      icon: Images.CognitiveServices,
      key: 'luisAuthoring',
    },
    {
      name: luisResourceName,
      icon: Images.CognitiveServices,
      key: 'luisPrediction',
    },
    {
      name: qnaAccountName,
      icon: Images.CognitiveServices,
      key: 'qna',
    },
    {
      name: azureServicePlanName,
      icon: Images.AppServicePlan,
      key: 'servicePlan',
    },
  ];

  return previewList;
};