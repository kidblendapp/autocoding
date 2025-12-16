export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders 
      })
    }

    try {
      // Parse request from Jira
      const body = await request.json()
      const { issueKey, configFile } = body

      // Validate input
      if (!issueKey) {
        return new Response(JSON.stringify({ 
          error: 'issueKey is required' 
        }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get configuration from environment variables (secrets)
      const GITHUB_OWNER = env.GITHUB_OWNER
      const GITHUB_REPO = env.GITHUB_REPO
      const GITHUB_TOKEN = env.GITHUB_TOKEN
      const DEFAULT_CONFIG = env.DEFAULT_CONFIG || 'agents/story_description.json'
      const GITHUB_REF = env.GITHUB_REF || 'main'

      // Validate required secrets
      if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_TOKEN) {
        return new Response(JSON.stringify({ 
          error: 'Missing required configuration. Please set GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN secrets.' 
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // First, get the workflow ID to ensure we're using the correct workflow
      const workflowInfoResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/ai-teammate.yml`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'Jira-GitHub-Proxy'
          }
        }
      )

      if (!workflowInfoResponse.ok) {
        const errorText = await workflowInfoResponse.text()
        return new Response(JSON.stringify({ 
          success: false,
          error: `Failed to get workflow info: ${workflowInfoResponse.status}`,
          details: errorText
        }), {
          status: workflowInfoResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const workflowInfo = await workflowInfoResponse.json()
      const workflowId = workflowInfo.id

      // Call GitHub API to trigger workflow using workflow ID
      const githubResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${workflowId}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Jira-GitHub-Proxy'
          },
          body: JSON.stringify({
            ref: GITHUB_REF,
            inputs: {
              config_file: configFile || DEFAULT_CONFIG,
              encoded_config: issueKey
            }
          })
        }
      )

      // Check response
      if (githubResponse.status === 204) {
        return new Response(JSON.stringify({ 
          success: true,
          message: `GitHub workflow triggered for ${issueKey}`,
          configFile: configFile || DEFAULT_CONFIG
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        const errorText = await githubResponse.text()
        return new Response(JSON.stringify({ 
          success: false,
          error: `GitHub API error: ${githubResponse.status}`,
          details: errorText
        }), {
          status: githubResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false,
        error: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
}
