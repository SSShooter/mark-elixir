import MindElixir from 'mind-elixir';
import type { MindElixirData, NodeObj, Options } from 'mind-elixir';

interface CallMapNodeObj extends NodeObj {
  call: StringifyCommonCall
  parent?: CallMapNodeObj
}
interface Window {
  acquireVsCodeApi(): {
    postMessage: (message: MessageFromWebview) => void
  }
}
declare const window: Window & typeof globalThis;

const vsc = window.acquireVsCodeApi();
const E = MindElixir.E;
const options: Options = {
  el: '#map',
  newTopicName: '子节点',
  // direction: MindElixir.LEFT,
  direction: MindElixir.RIGHT,
  // data: MindElixir.new('new topic'),
  locale: 'en',
  draggable: false,
  editable: false,
  contextMenu: true,
  contextMenuOption: {
    focus: true,
    link: true,
    extend: [
      {
        name: 'Node edit',
        onclick: () => {
          alert('extend menu');
        },
      },
    ],
  },
  toolBar: true,
  nodeMenu: true,
  keypress: true,
  allowUndo: false,
  // mainBranchStyle: 2,
  theme: MindElixir.DARK_THEME,
};

const handleChild = (call: StringifyCommonCall): any => {
  return {
    topic: call.target.name,
    id: Math.random().toString(),
    call,
    children: call.children?.map(handleChild),
    tags: [call.target.uri.path.split('/').at(-1)],
  };
};

const handleMessage = (event: MessageEvent<MessageFromVSCode>) => {
  if (event.data.command === 'init') {
    console.log(event.data);
    const payload = event.data.payload;
    if (payload.type === 'in') {
      options.direction = MindElixir.LEFT;
    }
    const data: MindElixirData = {
      nodeData: {
        topic: payload.name,
        id: 'root',
        root: true,
        children: payload.children?.map(handleChild),
      },
    };
    const mind = new MindElixir(options);
    mind.init(data);
    mind.bus.addListener('selectNode', (nodeData: CallMapNodeObj, e) => {
      console.log(nodeData);
      vsc.postMessage({
        command: e.ctrlKey ? 'openAndReveal' : 'reveal',
        payload: {
          pUri: nodeData?.parent?.call?.target.uri.path,
          call: nodeData.call,
        },
      });
    });
  }
};
window.addEventListener('message', handleMessage);
