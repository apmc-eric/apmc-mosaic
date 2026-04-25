import type { SlackViewState } from './types'

type Project = { id: string; name: string }
type Designer = { id: string; name: string | null; first_name: string | null; last_name: string | null }

function designerLabel(d: Designer): string {
  if (d.name?.trim()) return d.name.trim()
  const parts = [d.first_name, d.last_name].filter(Boolean)
  return parts.join(' ') || 'Unknown'
}

export function buildMosaicModal(params: {
  projects: Project[]
  designers: Designer[]
  privateMetadata: string
  state?: SlackViewState | null
  selectedProjectId?: string | null
}): object {
  const { projects, designers, privateMetadata, state, selectedProjectId } = params
  const v = state?.values ?? {}

  const titleValue = v.title_block?.title_input?.value ?? undefined
  const descValue = v.description_block?.description_input?.value ?? undefined
  const checkinDate = v.checkin_date_block?.checkin_date?.selected_date ?? undefined
  const checkinTime = v.checkin_time_block?.checkin_time?.selected_time ?? undefined
  const availDate = v.availability_date_block?.availability_date?.selected_date ?? undefined
  const availTime = v.availability_time_block?.availability_time?.selected_time ?? undefined

  const selectedProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId)
    : null

  const designersBlock: object =
    designers.length > 0
      ? {
          type: 'input',
          block_id: 'designers_block',
          label: { type: 'plain_text', text: 'Requested Designer(s)' },
          optional: true,
          element: {
            type: 'multi_static_select',
            action_id: 'designers_select',
            placeholder: { type: 'plain_text', text: 'Select designer(s)' },
            options: designers.map((d) => ({
              text: { type: 'plain_text', text: designerLabel(d) },
              value: d.id,
            })),
          },
        }
      : {
          type: 'section',
          block_id: 'designers_block',
          text: {
            type: 'mrkdwn',
            text: selectedProjectId
              ? '_No designers are assigned to this project type._'
              : '_Select a project type to see available designers._',
          },
        }

  const blocks: object[] = [
    {
      type: 'input',
      block_id: 'title_block',
      label: { type: 'plain_text', text: 'Title' },
      element: {
        type: 'plain_text_input',
        action_id: 'title_input',
        placeholder: { type: 'plain_text', text: 'Brief title for your request' },
        ...(titleValue ? { initial_value: titleValue } : {}),
      },
    },
    {
      type: 'input',
      block_id: 'description_block',
      label: { type: 'plain_text', text: 'Description' },
      hint: { type: 'plain_text', text: 'Plain text only. Paste any relevant links directly in the text.' },
      element: {
        type: 'plain_text_input',
        action_id: 'description_input',
        multiline: true,
        placeholder: {
          type: 'plain_text',
          text: 'Describe your request. Paste any relevant URLs here.',
        },
        ...(descValue ? { initial_value: descValue } : {}),
      },
    },
    {
      type: 'input',
      block_id: 'project_type_block',
      dispatch_action: true,
      label: { type: 'plain_text', text: 'Project Type' },
      optional: true,
      element: {
        type: 'static_select',
        action_id: 'project_type_select',
        placeholder: { type: 'plain_text', text: 'Select a project type' },
        options: projects.map((p) => ({
          text: { type: 'plain_text', text: p.name },
          value: p.id,
        })),
        ...(selectedProject
          ? {
              initial_option: {
                text: { type: 'plain_text', text: selectedProject.name },
                value: selectedProject.id,
              },
            }
          : {}),
      },
    },
    designersBlock,
    {
      type: 'input',
      block_id: 'checkin_date_block',
      label: {
        type: 'plain_text',
        text: 'When would you like to check in on this request?',
      },
      optional: true,
      element: {
        type: 'datepicker',
        action_id: 'checkin_date',
        placeholder: { type: 'plain_text', text: 'Select date' },
        ...(checkinDate ? { initial_date: checkinDate } : {}),
      },
    },
    {
      type: 'input',
      block_id: 'checkin_time_block',
      label: { type: 'plain_text', text: 'Check-in Time' },
      optional: true,
      element: {
        type: 'timepicker',
        action_id: 'checkin_time',
        placeholder: { type: 'plain_text', text: 'Select time' },
        ...(checkinTime ? { initial_time: checkinTime } : {}),
      },
    },
    {
      type: 'input',
      block_id: 'availability_date_block',
      label: {
        type: 'plain_text',
        text: 'When are you available for a 15–30 min follow-up if needed?',
      },
      optional: true,
      element: {
        type: 'datepicker',
        action_id: 'availability_date',
        placeholder: { type: 'plain_text', text: 'Select date' },
        ...(availDate ? { initial_date: availDate } : {}),
      },
    },
    {
      type: 'input',
      block_id: 'availability_time_block',
      label: { type: 'plain_text', text: 'Follow-up Time' },
      optional: true,
      element: {
        type: 'timepicker',
        action_id: 'availability_time',
        placeholder: { type: 'plain_text', text: 'Select time' },
        ...(availTime ? { initial_time: availTime } : {}),
      },
    },
  ]

  return {
    type: 'modal',
    callback_id: 'mosaic_submit',
    title: { type: 'plain_text', text: 'Submit Design Request' },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    private_metadata: privateMetadata,
    blocks,
  }
}
