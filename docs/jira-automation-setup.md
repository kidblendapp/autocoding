# JIRA Automation Setup for AI Teammate Workflow

This guide explains how to configure JIRA automation rules to trigger the AI teammate workflow via the Cloudflare Worker.

## Overview

The Cloudflare Worker acts as a proxy between JIRA and GitHub Actions. When triggered, it:
1. Receives a POST request from JIRA with the issue key and config file
2. Calls the GitHub Actions API to trigger the `ai-teammate.yml` workflow
3. Returns a success/error response

## Prerequisites

1. **Cloudflare Worker URL**: Get your deployed worker URL (e.g., `https://autocoding.kidblendapp.workers.dev/`)
2. **Available Config Files**:
   - `agents/story_questions.json` - For generating questions
   - `agents/story_description.json` - For enhancing story descriptions
   - `agents/solution_description.json` - For solution design
   - `agents/subtask_implementation.json` - For development tasks

## JIRA Automation Rule Setup

### Option 1: Trigger by Label (Recommended)

Create separate automation rules for each label type:

#### Rule 1: AI Questions
**Trigger**: When a label is added
- **Label**: `AI_questions`

**Action**: Send web request
- **URL**: `https://YOUR-WORKER-URL.workers.dev`
- **Method**: `POST`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (JSON):
  ```json
  {
    "issueKey": "{{issue.key}}",
    "configFile": "agents/story_questions.json"
  }
  ```

#### Rule 2: AI Description
**Trigger**: When a label is added
- **Label**: `AI_description`

**Action**: Send web request
- **URL**: `https://YOUR-WORKER-URL.workers.dev`
- **Method**: `POST`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (JSON):
  ```json
  {
    "issueKey": "{{issue.key}}",
    "configFile": "agents/story_description.json"
  }
  ```

#### Rule 3: AI Solution
**Trigger**: When a label is added
- **Label**: `AI_solution`

**Action**: Send web request
- **URL**: `https://YOUR-WORKER-URL.workers.dev`
- **Method**: `POST`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (JSON):
  ```json
  {
    "issueKey": "{{issue.key}}",
    "configFile": "agents/solution_description.json"
  }
  ```

#### Rule 4: AI Development
**Trigger**: When a label is added
- **Label**: `AI_development`

**Action**: Send web request
- **URL**: `https://YOUR-WORKER-URL.workers.dev`
- **Method**: `POST`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (JSON):
  ```json
  {
    "issueKey": "{{issue.key}}",
    "configFile": "agents/subtask_implementation.json"
  }
  ```

### Option 2: Trigger by Status Change

You can also trigger based on status transitions:

**Trigger**: Issue transitioned
- **From**: Any status
- **To**: `In Progress` (or your desired status)

**Condition**: Issue has label
- **Label**: `AI_description` (or any AI label)

**Action**: Send web request
- Same configuration as above, but you may want to use a smart value to determine the config file based on the label

### Option 3: Trigger by Custom Field

If you have a custom field for workflow type:

**Trigger**: Issue updated
- **Field**: `Workflow Type` (or your custom field)

**Action**: Send web request
- **Body** (JSON with smart value):
  ```json
  {
    "issueKey": "{{issue.key}}",
    "configFile": "{{#if (issue.customfield_10001 == "Questions")}}agents/story_questions.json{{else if (issue.customfield_10001 == "Description")}}agents/story_description.json{{else}}agents/story_description.json{{/if}}"
  }
  ```

## Step-by-Step Instructions

### 1. Access JIRA Automation

1. Go to **Project Settings** → **Automation**
2. Click **Create rule** or **Add rule**

### 2. Configure Trigger

1. Select **Trigger**: "Label added" (or your preferred trigger)
2. Configure the trigger:
   - For label-based: Select the specific label (e.g., `AI_description`)
   - For status-based: Select the status transition

### 3. Add Condition (Optional)

Add conditions to prevent duplicate triggers:
- **Issue has label**: Only if the label exists
- **Issue type**: Only for specific issue types (e.g., Story)
- **Project**: Only for specific projects

### 4. Configure Web Request Action

1. Click **Add component** → **Send web request**
2. Configure:
   - **Web request URL**: Your Cloudflare Worker URL
   - **HTTP method**: `POST`
   - **HTTP headers**: 
     - Key: `Content-Type`
     - Value: `application/json`
   - **Request body**: Select "JSON" and paste:
     ```json
     {
       "issueKey": "{{issue.key}}",
       "configFile": "agents/story_description.json"
     }
     ```

### 5. Add Post-Function (Optional)

After the web request, you might want to:
- Remove the label to prevent re-triggering
- Add a comment with the workflow status
- Transition the issue to a different status

Example: **Add comment**
- **Comment**: `AI workflow triggered for {{issue.key}}. Check GitHub Actions for status.`

### 6. Test the Rule

1. Click **Test rule** or create a test issue
2. Add the label to trigger the automation
3. Check:
   - JIRA automation execution logs
   - Cloudflare Worker logs
   - GitHub Actions workflow runs

## Advanced Configuration

### Using Smart Values for Dynamic Config Selection

If you want to select the config file based on issue properties:

```json
{
  "issueKey": "{{issue.key}}",
  "configFile": "{{#if (issue.labels contains 'AI_questions')}}agents/story_questions.json{{else if (issue.labels contains 'AI_solution')}}agents/solution_description.json{{else}}agents/story_description.json{{/if}}"
}
```

### Error Handling

Add a branch rule to handle errors:

1. **If web request fails**:
   - Add comment: `Failed to trigger AI workflow: {{webRequest.responseBody}}`
   - Add label: `AI_workflow_failed`
   - Notify assignee

### Preventing Duplicate Triggers

Add conditions to prevent multiple triggers:
- **Issue does not have label**: `AI_processing` (add this label when triggering)
- **Issue status is not**: `Done` (or your completion status)

Then in your action:
1. Add label `AI_processing` before sending the web request
2. Remove the trigger label (e.g., `AI_description`)

## Testing

### Manual Test

You can test the Cloudflare Worker directly using curl:

```bash
curl -X POST https://YOUR-WORKER-URL.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "issueKey": "AP-123",
    "configFile": "agents/story_description.json"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "GitHub workflow triggered for AP-123",
  "configFile": "agents/story_description.json"
}
```

### JIRA Test

1. Create a test issue
2. Add the appropriate label
3. Check:
   - Automation execution log shows success
   - GitHub Actions shows a new workflow run
   - The workflow uses the correct config file

## Troubleshooting

### Common Issues

1. **401/403 Errors**: Check Cloudflare Worker secrets are set correctly
2. **404 Errors**: Verify the worker URL is correct
3. **Workflow not triggered**: Check GitHub token has `workflow` scope
4. **CORS errors**: The worker already handles CORS, but verify headers are correct

### Debugging

1. **Check JIRA Automation Logs**:
   - Project Settings → Automation → Execution history
   - Look for the web request execution

2. **Check Cloudflare Worker Logs**:
   - Cloudflare Dashboard → Workers → Your worker → Logs

3. **Check GitHub Actions**:
   - Repository → Actions → Workflow runs

## Best Practices

1. **Use labels for different workflow types**: This makes it easy to trigger different configs
2. **Remove labels after triggering**: Prevents duplicate runs
3. **Add processing labels**: Use `AI_processing` to mark issues being processed
4. **Monitor execution**: Set up notifications for failed web requests
5. **Test in a test project first**: Before applying to production

## Example: Complete Automation Rule

**Name**: Trigger AI Description Enhancement

**Trigger**: 
- Label `AI_description` added

**Conditions**:
- Issue type is `Story`
- Issue does not have label `AI_processing`

**Actions**:
1. Add label `AI_processing`
2. Send web request:
   - URL: `https://autocoding.your-subdomain.workers.dev`
   - Method: `POST`
   - Body: `{"issueKey": "{{issue.key}}", "configFile": "agents/story_description.json"}`
3. Add comment: `AI description enhancement workflow triggered.`
4. Remove label `AI_description` (to prevent re-triggering)

**Branch rule** (if web request fails):
- Add comment: `Failed to trigger workflow. Please try again.`
- Remove label `AI_processing`

