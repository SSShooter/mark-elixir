import { NodeObj } from 'mind-elixir';

type SRange = {
  line: number;
  character: number;
};

type Uri = {
  $mid: number;
  path: string;
  scheme: string;
};

type SelectionRange = [SRange, SRange];

type Target = {
  kind: number;
  name: string;
  detail: string;
  uri: Uri;
  range: [SRange, SRange];
  selectionRange: SelectionRange;
  _sessionId: string;
  _itemId: string;
};
type StringifyCommonCall = {
  name: string;
  fromRanges: [SRange, SRange][];
  target: Target;
  children?: StringifyCommonCall[];
};
type StringifyCallHierarchyOutgoingCall = {
  fromRanges: [SRange, SRange][];
  to: Target;
};
type StringifyCallHierarchyIncomingCall = {
  fromRanges: [SRange, SRange][];
  from: Target;
};

type MessageFromWebview = {
  command: 'reveal' | 'openAndReveal';
  payload: { call: StringifyCommonCall; pUri?: string };
};

type MessageFromVSCode = {
  command: 'init';
  payload: {
    name: string;
    children: NodeObj[];
  };
};
