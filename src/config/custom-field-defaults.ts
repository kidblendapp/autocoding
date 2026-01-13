/**
 * Default custom field mappings for JIRA fields.
 * These values match the currently hardcoded field IDs in the codebase.
 */

import type { CustomFieldMapping } from '../services/jira-extractor';

/**
 * Default custom field mapping matching current hardcoded values.
 */
export const DEFAULT_CUSTOM_FIELD_MAPPING: CustomFieldMapping = {
  team: 'customfield_10001',
  storyPoints: 'customfield_10052',
  originalEstimate: 'customfield_10410',
  epicLink: 'customfield_10008',
  sprint: 'customfield_10010',
  dateField: 'customfield_10098',
  dateTimeField: 'customfield_10012',
};

/**
 * Default display names for custom fields.
 */
export const DEFAULT_CUSTOM_FIELD_NAMES: Record<string, string> = {
  'customfield_10001': 'Team',
  'customfield_10052': 'Story Points',
  'customfield_10410': 'Original Estimate',
  'customfield_10008': 'Epic Link',
  'customfield_10010': 'Sprint',
  'customfield_10098': 'Date Field',
  'customfield_10012': 'DateTime Field',
};

/**
 * Gets the custom field ID for a given field type, using config or default.
 * 
 * @param fieldType - The field type (e.g., 'team', 'storyPoints')
 * @param config - JIRA configuration with optional customFieldMapping
 * @returns Custom field ID or undefined if not configured
 */
export function getCustomFieldId(
  fieldType: keyof CustomFieldMapping,
  config?: { customFieldMapping?: CustomFieldMapping }
): string | undefined {
  return config?.customFieldMapping?.[fieldType] || DEFAULT_CUSTOM_FIELD_MAPPING[fieldType];
}

/**
 * Gets the display name for a custom field ID.
 * 
 * @param fieldId - Custom field ID (e.g., "customfield_10001")
 * @param config - JIRA configuration with optional customFieldNames
 * @returns Display name or field ID if not configured
 */
export function getCustomFieldName(
  fieldId: string,
  config?: { customFieldNames?: Record<string, string> }
): string {
  return config?.customFieldNames?.[fieldId] || DEFAULT_CUSTOM_FIELD_NAMES[fieldId] || fieldId;
}

/**
 * Merges custom field mapping with defaults, ensuring all fields have values.
 * 
 * @param customMapping - Optional custom field mapping from config
 * @returns Complete custom field mapping with defaults filled in
 */
export function mergeCustomFieldMapping(
  customMapping?: CustomFieldMapping
): CustomFieldMapping {
  return {
    ...DEFAULT_CUSTOM_FIELD_MAPPING,
    ...customMapping,
  };
}
