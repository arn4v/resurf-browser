import { NewEvent } from './types'

type EventStruct<T extends Pick<NewEvent, 'type'> & { metadata: object }> = T

type TabNavigateForward = EventStruct<{
  type: 'tab_navigate_forward'
  metadata: {
    next_url: string
  }
}>

type TabNavigateBack = EventStruct<{
  type: 'tab_navigate_back'
  metadata: {
    next_url: string
  }
}>

type TabUnfocused = EventStruct<{
  type: 'tab_unfocused'
  metadata: {}
}>

type TabFocusedEvent = EventStruct<{
  type: 'tab_focused'
  metadata: {}
}>

export type TabEvent = TabFocusedEvent | TabUnfocused | TabNavigateBack | TabNavigateForward
