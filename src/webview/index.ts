import MindElixir from 'mind-elixir';
import type {
  MindElixirData,
  MindElixirInstance,
  NodeObj,
  Options,
} from 'mind-elixir';

interface Window {
  injectedData: MindElixirData;
  acquireVsCodeApi(): {
    postMessage: (message: any) => void;
  };
}
declare const window: Window & typeof globalThis;

const vsc = window.acquireVsCodeApi && window.acquireVsCodeApi();

const setExpandedAll = (data: NodeObj, expanded: boolean) => {
  data.expanded = expanded;
  if (data.children) {
    for (let i = 0; i < data.children.length; i++) {
      setExpandedAll(data.children[i], expanded);
    }
  }
};

let data: MindElixirData = window.injectedData;
let mind: MindElixirInstance | null = null;

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

mind = new MindElixir(options);
console.log(JSON.stringify(data));
mind.init(data);
mind.bus.addListener('selectNode', (nodeData: NodeObj, e) => {
  console.log(nodeData);
  vsc.postMessage({});
});

const toolBar = document.querySelector('.mind-elixir-toolbar.rb');
const expandAllBtn = document.createElement('span');
expandAllBtn.innerHTML = 'Expand All';
const collapseAllBtn = document.createElement('span');
collapseAllBtn.innerHTML = 'Collapse All';
expandAllBtn?.addEventListener('click', () => {
  setExpandedAll(data.nodeData, true);
  mind.refresh();
});
collapseAllBtn?.addEventListener('click', () => {
  setExpandedAll(data.nodeData, false);
  mind.refresh();
});
toolBar?.appendChild(expandAllBtn);
toolBar?.appendChild(collapseAllBtn);

if (vsc) {
  const downloadBtn = document.createElement('span');
  downloadBtn.innerHTML = 'Download';
  downloadBtn.addEventListener('click', () => {
    vsc.postMessage({ command: 'download' });
  });
  toolBar?.appendChild(downloadBtn);
}
// window.addEventListener('message', handleMessage);
