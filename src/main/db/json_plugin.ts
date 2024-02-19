import {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  UnknownRow,
} from 'kysely'

class JSONPlugin implements KyselyPlugin {
  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return args.node
  }

  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return {
      ...args.result,
      rows: args.result.rows.map((row) => row),
    }
  }

  // async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
  //   return {
  //     ...args.result,
  //     rows: args.result.rows,
  //   }
  // }
}
