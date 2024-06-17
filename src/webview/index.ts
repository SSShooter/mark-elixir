import MindElixir from 'mind-elixir';
import type {
  MindElixirData,
  MindElixirInstance,
  NodeObj,
  Options,
} from 'mind-elixir';
import { MessageFromVSCode } from '../../global';

interface Window {
  acquireVsCodeApi(): {
    postMessage: (message: any) => void;
  };
}
declare const window: Window & typeof globalThis;

const vsc = window.acquireVsCodeApi();

const setExpandedAll = (data: NodeObj, expanded: boolean) => {
  data.expanded = expanded;
  if (data.children) {
    for (let i = 0; i < data.children.length; i++) {
      setExpandedAll(data.children[i], expanded);
    }
  }
};

let data: MindElixirData = null;
let mind: MindElixirInstance | null = null;
const btnGroup = document.createElement('div');
btnGroup.className = 'btn-group';
btnGroup.innerHTML = `
  <button id="expand-all">Expand All</button>
  <button id="collapse-all">Collapse All</button>
`;
btnGroup.style.position = 'absolute';
btnGroup.style.bottom = '20px';
btnGroup.style.left = '0';
document.body.appendChild(btnGroup);
const expandAllBtn = document.getElementById('expand-all');
const collapseAllBtn = document.getElementById('collapse-all');
expandAllBtn?.addEventListener('click', () => {
  console.log(data);
  setExpandedAll(data.nodeData, true);
  mind.refresh();
});
collapseAllBtn?.addEventListener('click', () => {
  setExpandedAll(data.nodeData, false);
  mind.refresh();
});

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

const handleMessage = (event: MessageEvent<MessageFromVSCode>) => {
  if (event.data.command === 'init') {
    console.log(event.data);
    const payload = event.data.payload;
    data = {
      nodeData: {
        topic: payload.name,
        id: 'root',
        root: true,
        children: payload.children as any,
      },
    };
    mind = new MindElixir(options);
    console.log(JSON.stringify(data));
    mind.init(data);
    mind.bus.addListener('selectNode', (nodeData: NodeObj, e) => {
      console.log(nodeData);
      vsc.postMessage({});
    });
  }
};
window.addEventListener('message', handleMessage);
