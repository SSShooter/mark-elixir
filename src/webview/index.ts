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
expandAllBtn.title = 'Expand All';
expandAllBtn.innerHTML = '<svg t="1739342378874" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1617" width="200" height="200"><path d="M768 342.016H341.984v426.016H255.968V342.016q0-36 24.992-60.992t60.992-24.992h426.016v86.016z m-169.984-256H170.016q-34.016 0-59.008 24.992t-24.992 59.008v428h84V170.016h428V86.016zM938.016 512v342.016q0 34.016-24.992 59.008t-59.008 24.992H512q-36 0-60.992-24.992t-24.992-59.008V512q0-36 24.992-60.992T512 426.016h342.016q34.016 0 59.008 24.992T938.016 512z m-84 128h-128v-128H640v128h-128v86.016h128v128h86.016v-128h128V640z" p-id="1618"></path></svg>';
const collapseAllBtn = document.createElement('span');
collapseAllBtn.title = 'Collapse All';
collapseAllBtn.innerHTML = '<svg t="1739342411256" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2596" width="200" height="200"><path d="M597.333333 170.666667H170.666667v426.666666H85.333333V170.666667a85.333333 85.333333 0 0 1 85.333334-85.333334h426.666666v85.333334m170.666667 85.333333H341.333333a85.333333 85.333333 0 0 0-85.333333 85.333333v426.666667h85.333333V341.333333h426.666667V256m170.666667 256v341.333333a85.333333 85.333333 0 0 1-85.333334 85.333334h-341.333333a85.333333 85.333333 0 0 1-85.333333-85.333334v-341.333333a85.333333 85.333333 0 0 1 85.333333-85.333333h341.333333a85.333333 85.333333 0 0 1 85.333334 85.333333m-85.333334 128h-341.333333v85.333333h341.333333v-85.333333z" p-id="2597"></path></svg>';
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
  downloadBtn.title = 'Download';
  downloadBtn.innerHTML = '<svg t="1739342547294" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3585" width="200" height="200"><path d="M731.428571 341.333333h73.142858a73.142857 73.142857 0 0 1 73.142857 73.142857v414.476191a73.142857 73.142857 0 0 1-73.142857 73.142857H219.428571a73.142857 73.142857 0 0 1-73.142857-73.142857V414.47619a73.142857 73.142857 0 0 1 73.142857-73.142857h73.142858v73.142857H219.428571v414.476191h585.142858V414.47619h-73.142858v-73.142857z m-176.90819-242.590476l0.048762 397.092572 84.577524-84.601905 51.687619 51.712-172.373334 172.397714-172.397714-172.373333 51.712-51.736381 83.626667 83.626666V98.742857h73.142857z" p-id="3586"></path></svg>';
  downloadBtn.addEventListener('click', () => {
    vsc.postMessage({ command: 'download' });
  });
  toolBar?.appendChild(downloadBtn);
}
// window.addEventListener('message', handleMessage);
