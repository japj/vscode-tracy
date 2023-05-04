import React from 'react';
import LogView from './log/LogView';
import MinimapView from './minimap/MinimapView';
import LogFile from './LogFile';
import { LogViewState } from './types';
import { LOG_HEADER_HEIGHT, MINIMAP_COLUMN_WIDTH, BORDER } from './constants';
import { VSCodeButton, VSCodeTextField, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import StatesDialog from './rules/Dialogs/StatesDialog';
import FlagsDialog from './rules/Dialogs/FlagsDialog';
import Rule from './rules/Rule';
import MinimapHeader from './minimap/MinimapHeader';
import { display } from '@microsoft/fast-foundation';

interface Props {
}
interface State {
    logFile: LogFile;
    logViewState: LogViewState | undefined;
    rules: Rule[];
    showStatesDialog: boolean;
    showFlagsDialog: boolean;
    showMinimapHeader: boolean;
    searchColumn: string;
    searchText: string;
}

const COLUMN_0_HEADER_STYLE = {
    height: LOG_HEADER_HEIGHT, display: 'flex', justifyContent: 'center', alignItems: 'center', 
    borderLeft: BORDER, borderBottom: BORDER
};

const COLUMN_2_HEADER_STYLE = {
    height: '100%', display: 'flex', borderLeft: BORDER
}

export default class App extends React.Component<Props, State> {
    // @ts-ignore
    vscode = acquireVsCodeApi();

    constructor(props: Props) {
        super(props);
        this.state = {logFile: LogFile.create([], []), logViewState: undefined,
            rules: [], showStatesDialog: false, showFlagsDialog: false, 
            showMinimapHeader: true, searchColumn: 'All', searchText: ''};
        this.onMessage = this.onMessage.bind(this);
        window.addEventListener('message', this.onMessage);
        this.vscode.postMessage({type: 'update'});
    }

    filterOnEnter(key_press: any) {
        if (key_press === 'Enter') {
            this.vscode.postMessage({type: 'update'});
        }
    }

    findIndices(rows: string[][], col_index: number, str: string) {
        let indices: number[] = [];
        if (col_index === -1) {
            for (let i = 0; i < rows.length; i++) {
                if (rows[i].join(" ").indexOf(str) != -1)
                    indices.push(i);
            }
        }
        else {
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][col_index].indexOf(str) != -1)
                    indices.push(i);
            }
        }
        return indices;        
    }

    onMessage(event: MessageEvent) {
        let logFile: LogFile;
        const message = event.data;
        if (message.type === 'update') {
            const rules = message.rules.map((r) => Rule.fromJSON(r)).filter((r) => r);
            let lines = JSON.parse(message.text);
            logFile = LogFile.create(lines, rules);
            if (this.state.searchText !== '') {
                const col_index = this.state.logFile.headers.findIndex(h => h.name === this.state.searchColumn)
                const filteredIndices = this.findIndices(logFile.rows, col_index, this.state.searchText);
                let filtered_lines = lines.filter((l, i) => filteredIndices.includes(i));
                if (filtered_lines.length === 0) {
                    filtered_lines = [lines[0]]
                    for (let k of Object.keys(lines[0]))
                        filtered_lines[0][k] = ''
                }
                logFile = LogFile.create(filtered_lines, rules);
            }
            this.setState({logFile, rules});
        }
    }

    handleDialogActions(newRules: Rule[], is_close: boolean) {
        this.vscode.postMessage({type: 'save_rules', rules: newRules.map((r) => r.toJSON())});
        if (is_close === true)
            this.setState({rules: newRules, logFile: this.state.logFile.setRules(newRules), showStatesDialog: false, showFlagsDialog: false});
        else
            this.setState({rules: newRules});
    }

    render() {
        const minimapWidth = this.state.logFile.amountOfColorColumns() * MINIMAP_COLUMN_WIDTH;
        const minimapHeight = this.state.showMinimapHeader ? '12%' : '5%' ;
        const logviewHeight = this.state.showMinimapHeader ? '88%' : '95%' ;
        const all_columns = ['All', ...this.state.logFile.contentHeaders, ...this.state.rules.map(i=>i.column)];
        return (
            <div style={{display:'flex', flexDirection: 'column', height: '100%'}}>
                <div style={{display: 'flex', flexDirection: 'row', height: minimapHeight}}>
                    <div style={{flex: 1, display: 'flex', justifyContent: 'end'}}>
                        <VSCodeDropdown style={{marginRight: '5px'}} onChange={(e) => this.setState({searchColumn: e.target.value})}>
                            {all_columns.map((col, col_i) => <VSCodeOption key={col_i} value={col}>{col}</VSCodeOption>)}
                        </VSCodeDropdown>
                        <VSCodeTextField style={{marginRight: '5px'}} placeholder="Search Text" onInput={(e) => this.setState({searchText: e.target.value})} onKeyDown={(e) => this.filterOnEnter(e.key)}>
                            <span slot="end" className="codicon codicon-search"></span>
                        </VSCodeTextField>
                        {this.state.showMinimapHeader &&
                            <VSCodeButton appearance='icon' onClick={() => this.setState({showMinimapHeader: false})}>
                                <i className='codicon codicon-arrow-down' />
                            </VSCodeButton>
                        }
                        {!this.state.showMinimapHeader &&
                            <VSCodeButton appearance='icon' onClick={() => this.setState({showMinimapHeader: true})}>
                                <i className='codicon codicon-arrow-up' />
                            </VSCodeButton>
                        }
                    </div>          
                    {!this.state.showMinimapHeader &&
                        <div className='header-background' style={{width: minimapWidth}}></div>
                    }
                    {this.state.showMinimapHeader &&
                        <div className='header-background' style={{width: minimapWidth, ...COLUMN_2_HEADER_STYLE}}>
                            <MinimapHeader logFile={this.state.logFile}/>
                        </div>
                    }

                </div>
                <div style={{display: 'flex', flexDirection: 'row', height: logviewHeight}}>
                    <div style={{flex: 1, display: 'flex'}}>
                        <LogView
                            logFile={this.state.logFile} 
                            onLogViewStateChanged={(logViewState) => this.setState({logViewState})}
                        />
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', width: minimapWidth}}>
                        <div className='header-background' style={COLUMN_0_HEADER_STYLE}>
                            <VSCodeButton appearance='icon' onClick={() => this.setState({showFlagsDialog: true})}>
                                <i className="codicon codicon-tag"/>
                            </VSCodeButton>
                            <VSCodeButton appearance='icon' onClick={() => this.setState({showStatesDialog: true})}>
                                <i className="codicon codicon-settings-gear"/>
                            </VSCodeButton>
                        </div>
                        {this.state.logViewState &&
                            <MinimapView
                                logFile={this.state.logFile}
                                logViewState={this.state.logViewState}/>
                        }
                    </div>
                    { this.state.showStatesDialog &&
                    <StatesDialog
                        logFile={this.state.logFile}
                        initialRules={this.state.rules}
                        onClose={(newRules) => this.handleDialogActions(newRules, true)}
                        onReturn={(newRules) => this.handleDialogActions(newRules, false)}
                    />
                    }
                    { this.state.showFlagsDialog &&
                    <FlagsDialog
                        logFile={this.state.logFile}
                        initialRules={this.state.rules}
                        onClose={(newRules) => this.handleDialogActions(newRules, true)}
                        onReturn={(newRules) => this.handleDialogActions(newRules, false)}
                    /> 
                    }
                </div>
            </div>
        );
    }
}
