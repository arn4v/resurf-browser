import { NewEvent } from './types'

type EventStruct<
  T extends {
    type: string
  } & (
    | {
        data?: never
      }
    | {
        data: object
      }
  ),
> = T

type TabNavigateForward = EventStruct<{
  type: 'tab_navigate_forward'
  data: {
    next_url: string
  }
}>

type TabNavigateBack = EventStruct<{
  type: 'tab_navigate_back'
  data: {
    next_url: string
  }
}>

type TabUnfocused = EventStruct<{
  type: 'tab_unfocused'
  data: {}
}>

type TabFocusedEvent = EventStruct<{
  type: 'tab_focused'
  data: {}
}>

export type TabEvent = TabFocusedEvent | TabUnfocused | TabNavigateBack | TabNavigateForward
