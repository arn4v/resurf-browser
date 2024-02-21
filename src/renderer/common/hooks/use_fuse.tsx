import Fuse, { IFuseOptions } from 'fuse.js'
import * as React from 'react'

export interface UseFuse<T> {
  data: T[]
  query: string
  options: IFuseOptions<T>
}

// https://github.com/arn4v/use-fuse2/blob/main/src/index.ts
export const useFuse = <T,>({ data, query = '', options = {} }: UseFuse<T>) => {
  const fuse = React.useMemo(() => new Fuse(data, options), [data, options])

  const result = React.useMemo(() => {
    const value = query
      ? fuse.search(query).map((item) => {
          return item.item
        })
      : data

    return value
  }, [data, fuse, query])

  return { fuse, result }
}

export default useFuse
