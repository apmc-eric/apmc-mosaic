export interface SlackBlockAction {
  action_id: string
  block_id: string
  type: string
  action_ts: string
  selected_option?: { text: { type: string; text: string }; value: string }
  selected_options?: Array<{ text: { type: string; text: string }; value: string }>
  selected_date?: string
  selected_time?: string
}

export type SlackStateValue = {
  type: string
  value?: string | null
  selected_option?: { value: string; text?: { text: string } } | null
  selected_options?: Array<{ value: string; text?: { text: string } }> | null
  selected_date?: string | null
  selected_time?: string | null
}

export interface SlackViewState {
  values: Record<string, Record<string, SlackStateValue>>
}

export interface SlackView {
  id: string
  callback_id: string
  state: SlackViewState
  private_metadata: string
}

export interface SlackBlockActionsPayload {
  type: 'block_actions'
  trigger_id: string
  view: SlackView
  actions: SlackBlockAction[]
  user: { id: string; username: string; name: string; team_id: string }
}

export interface SlackViewSubmissionPayload {
  type: 'view_submission'
  view: SlackView
  user: { id: string; username: string; name: string; team_id: string }
}

export interface SlackPrivateMetadata {
  submitter_id: string
  slack_user_id: string
  channel_id: string
  response_url: string
  timezone: string | null
}
