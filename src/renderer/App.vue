<template>
  <div id="app">
	<el-container>
		<el-header>
			<el-row :gutter="20">
				<el-col :span="3">
					nginx根路径:
				</el-col>
			  <el-col :span="10">
				  <el-input v-model="path" placeholder="请输入nginx根路径"  @click.native="open()"></el-input>
			  </el-col>
				<el-col :span="3">
					<el-button type="success" v-if="state == 'open'">
						已启动
					</el-button>
					<el-button type="danger" v-if="state == 'close'">
						关闭中
					</el-button>
				</el-col>
			</el-row>
		</el-header>
	  <el-container>
		<el-aside width="300px">
			<el-container>
				<el-main >
					<el-menu
							class="el-menu-vertical-demo"
							@open="handleOpen"
							@close="handleClose"
							@select="handleSelect">

						<el-menu-item v-for="(item, index) in menus" :index="index.toString()" v-on:dblclick.native="changeNginxConf(item, index)">
							<el-row :gutter="20">
								<el-col :span="22">
									<i class="el-icon-check"></i>
									<span>{{item.name}}</span>
								</el-col>
								<el-col :span="2">
									<el-switch
											:width="20"
											v-model="item.switch"
											active-color="#67C23A"
											disabled>
									</el-switch>
								</el-col>
							</el-row>

						</el-menu-item>
					</el-menu>
				</el-main>
				<el-footer class="el-aside-footer">
					<el-checkbox v-model="isMultiSelect" @change="changeMultiState()">是否多选</el-checkbox>
				</el-footer>
			</el-container>
		</el-aside>
		<el-container>
		  <el-main >
				<textarea id="editor" :value="code"></textarea>
		  </el-main>
		  <el-footer>
			  <el-button type="primary" @click="saveNginxConfContent()">保存</el-button>
		  </el-footer>
		</el-container>
	  </el-container>
	</el-container>

	  <el-dialog title="nginx设置" :visible.sync="dialogFormVisible">
		  <el-form>
			  <el-form-item label="nginx根路径" :label-width="formLabelWidth" required>
				  <el-input v-model="path" auto-complete="off" @click.native="open()"></el-input>
			  </el-form-item>
		  </el-form>
		  <div slot="footer" class="dialog-footer">
			  <el-button type="primary" @click="dialogFormVisible = false">确 定</el-button>
		  </div>
	  </el-dialog>

  </div>
</template>

<script>
	import fs from 'fs';
  import electron from 'electron'
  const remote = require('electron').remote;
  const {dialog, Menu, ipcMain, app, Tray} = require('electron').remote
	const Service = require('comlog-system-monitor-process');
    const CMP = require('comlog-process-manager');
  const {execFile, exec} = require('child_process');
  const storage = require('electron-json-storage');
  export default {
	data: function() {
		return {
			path: '',
            code: '',
			menus: [],
			index: -1,
			isMultiSelect: false,
			state: 'close',
            formLabelWidth: '120px',
            dialogFormVisible: false
		}
	},
    name: 'switch-nginx',
      created: function () {
          var application_menu = [
              {
                  label: 'nginx操作',
                  submenu: [
                      {
                          label: '启动nginx',
                          accelerator: 'CmdOrCtrl+O',
                          click: () => {
							  this.startNginx();
                          }
                      },
                      {
                          label: '重启nginx',
                          click: () => {
                              this.reloadNginx();
                          }
                      },
                      {
                          label: '停止nginx',
                          click: () => {
							  this.stopNginx();
                          }
                      },
                      {
                          label: '强制关闭',
                          click: () => {
                              this.forceStopNginx();
                          }
                      }
                  ]
              }
          ];
          let menu = Menu.buildFromTemplate(application_menu);
          Menu.setApplicationMenu(menu);

          let tray = remote.getGlobal('sharedObject').tray
          const contextMenu = Menu.buildFromTemplate([
              {
                  label: '启动nginx',
                  accelerator: 'CmdOrCtrl+O',
                  click: () => {
                      this.startNginx();
                  }
              },
              {
                  label: '重启nginx',
                  click: () => {
                      this.reloadNginx();
                  }
              },
              {
                  label: '停止nginx',
                  click: () => {
                      this.stopNginx();
                  }
              },
              {
                  label: '强制关闭',
                  click: () => {
                      this.forceStopNginx();
                  }
              }
          ]);
          tray.setToolTip('This is my application.')
          tray.setContextMenu(contextMenu)
      },
	  mounted: function () {
          storage.get('nginxconf', (error, data) => {
              if (error) throw error;
              if(data) {
                  this.path = data.path;
                  this.isMultiSelect = data.isMultiSelect;
                  this.explore();
              }
              if(this.path.trim().length == 0) {
                  this.dialogFormVisible = true;
              }
          });
          let editor = document.getElementById("editor")
          this.codemirror = CodeMirror.fromTextArea(editor, {
              tabSize: 4,
              lineNumbers: true,
			  mode: 'text/x-nginx-conf',
              line: true
          });
          this.codemirror.setSize('100%', '100%');
          this.codemirror.on('change', (a) => {
              let v = a.getDoc().getValue();
              this.code = v;
          })


          CMP.lookup({name: 'nginx.exe'},  (err, result) => {
              if(result.length > 0) {
                  this.state = 'open';
			  } else {
                  this.state = 'close';
			  }
          });

		  this.startNginxMonitor();

      },
	methods: {
		open () {
			dialog.showOpenDialog({
				properties: [
					'openDirectory',
				]
			},(res) => {
				if(res) {
					this.path = res[0];

					this.explore();
                  	this.storeNginxConf();
				}
			})
       },
	   explore() {
           this.nginxExe = this.path + '\\nginx.exe';
           this.nginxConf = this.path + '\\conf\\vhosts/';
			let path = this.path + '\\conf\\vhosts/';
			fs.readdir(path, (err, files) => {
				//err 为错误 , files 文件名列表包含文件夹与文件
				if(err){
					console.log('error:\n' + err);
					return;
				}

                this.menus = [];
				files.forEach((file) => {
					fs.stat(path + '/' + file, (err, stat) => {
						if(err){console.log(err); return;}
						if(stat.isDirectory()){
							// 如果是文件夹遍历
							explorer(path + '/' + file);
						}else{
							// 读出所有的文件
							console.log('文件名:' + path + '/' + file);
							let fullpath =  path + '/' + file
							this.menus.push({name: file, path: fullpath,switch: !file.endsWith('_')});
						}
					});
				});
				if(this.menus.length > -1) {
                    this.index = 0;
				}
			});
	   },

		judgeStartNginx() {
		    if(this.state=='open') {
		        this.reloadNginx();
			} else {
		        this.startNginx();
			}
		},
        startNginx() {
            execFile(this.nginxExe, ['-p',  this.path], (err, data) => {
                console.log('Program output:', data);
                console.log('Program stderr:', err);
                if(err) {
                    this.showNotification('启动失败');
				} else {
                    this.showNotification('启动成功');
                    this.state = 'open';
				}
            });

        },

        stopNginx() {
            let cmd =  ['-s', 'stop', '-p', this.path];
            execFile( this.nginxExe, cmd, (err, data) => {
                console.log('Program output:', data);
                console.log('Program stderr:', err);
                if(err) {
                    this.showNotification('停止失败');
				} else {
                    this.showNotification('停止成功');
                    this.state = 'close';
				}

            });
        },
		forceStopNginx(callback) {
		  let cmd = 'Taskkill /IM nginx.exe /F';

		  if(this.state == 'close') {
		      callback && callback();
		      return;
		  }

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    this.showNotification('强制关闭失败');
                    return;
                }
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);
                if(callback) {
                    callback();
				} else {
                    this.showNotification('强制关闭成功');
				}
            });

		},
        reloadNginx() {
            let cmd =  ['-s', 'reload', '-p', this.path];
            execFile(this.nginxExe, cmd,  (err, data) => {
                console.log('Program output:', data);
                console.log('Program stderr:', err);

                if(err) {
                    this.forceStopNginx( () => {
						this.startNginx();
                    });
				} else  {
                    this.showNotification('重启成功');
                    this.state = 'open';
				}
            });
        },
		showNotification(body) {
            let myNotification = new Notification('提示', {
                body: body
            })

            myNotification.onclick = () => {
                console.log('Notification clicked')
            }
		},
        handleOpen(key, keyPath) {
            console.log(key, keyPath);
        },
        handleClose(key, keyPath) {
            console.log(key, keyPath);
        },
        handleSelect(index, indexPath){

		   let path = this.menus[index].path;

            fs.readFile(path, 'utf8',  (err, data) => {
                if (err) {
                    throw err;
                }
                this.code = data;
                this.codemirror.setValue(data);
                this.index = index;
            });
		},
        changeNginxConf(item, index) {
		    if(this.isMultiSelect) {
                this.changeNginxSingleConf(item)
			} else {
		       this.changeNginxMultiConf(index);
			}
		},

        changeNginxSingleConf(item) {
            let newPath = ''
            let newName = ''
            if(item.path.endsWith('_')) {
                newPath = item.path.substr(0, item.path.length -1);
                newName = item.name.substr(0, item.name.length -1);
            } else {
                newPath = item.path + '_';
                newName = item.name + '_';
            }
            fs.rename(item.path, newPath, (err) => {
                if(err) {
                    this.showNotification('切换失败');
                    throw err;
                }
                item.path = newPath;
                item.name = newName;
                item.switch = !item.switch;
                this.showNotification('切换成功');
                this.judgeStartNginx();
            });
		},

        changeNginxMultiConf(index) {
		    console.log(index);
            console.log('单选选-----');
		    let i =0, len = this.menus.length;
		    let promiseArr = []
		    for(; i< len; i++) {
		        let item = this.menus[i];
		        if(i == index) {
                    if(item.path.endsWith('_')) {
                        let p = new Promise((resolve, reject) => {
                            let newPath = item.path.substr(0, item.path.length -1);
                            let newName = item.name.substr(0, item.name.length -1);
                            fs.rename(item.path, newPath, (err) => {
                                if(err) {
                                    reject(err);
                                }
                                item.path = newPath;
                                item.name = newName;
                                item.switch = !item.switch;
                               resolve(item);
                            });
                        });
                        promiseArr.push(p);
                    }
				} else {
                    if(!(item.path.endsWith('_'))) {
                        let p = new Promise((resolve, reject) => {
                            let newPath = item.path + '_';
                            let newName = item.name + '_';
                            fs.rename(item.path, newPath, (err) => {
                                if(err) {
                                    reject(err);
                                }
                                item.path = newPath;
                                item.name = newName;
                                item.switch = !item.switch;
                                resolve(item);
                            });
						});
                        promiseArr.push(p);
                    }
                }
			}

            Promise.all(promiseArr).then(values => {
                this.showNotification('切换成功');
                this.judgeStartNginx();
            },  reason => {
                this.showNotification('切换失败---'+reson);
            });
		},
        saveNginxConfContent() {
			let item = this.menus[this.index];
			console.log(this.index);
            fs.writeFile(item.path, this.code, function (err) {

                if (err) {
                    throw err;
				}
                console.log('保存成功---'+item.path);
            });
			this.showNotification('保存成功---'+item.name );
        },
		storeNginxConf() {
            storage.set('nginxconf', { path: this.path, isMultiSelect: this.isMultiSelect }, function(error) {
                if (error) throw error;
            });
		},
        startNginxMonitor() {
            let csmf = new Service({
                name: 'nginx.exe',
                interval: 3000,
            });

            csmf.on('error', (err) => {
                console.error(err);
            });

            csmf.on('down', () => {
               	this.state='close'
                console.info('Process nginx is down');
            });

            csmf.on('up', () => {
                this.state='open'
                console.info('Process nginx is up');
            });

            csmf.start()
		},
        changeMultiState() {
		    this.storeNginxConf()
		}
    }
  }
</script>

<style>
	html, body{
		height: 100%;
		margin: 0px;
	}

	.el-header {
		background-color: #20A0FF;
		color: #FFF;
	}

  .el-header, .el-footer {
    text-align: center;
    line-height: 59px !important;
  }

  .el-aside {
    background-color: #545C64;
    color: #333;
    line-height: 200px;
      border-right: solid 1px #A0A0A0;
  }

    .el-aside  .el-menu-item {
        padding-left: 5px !important;
    }

  .el-main {
	  padding: 0px !important;
    background-color: #FFF;
    color: #333;
	  border-left: solid 1px #FFF;
	  border-bottom: solid 1px #A0A0A0;
  }

  .el-footer {
	  background-color: #F1F1F1;
	  text-align: right;
	  border-top: solid 1px #FFF;
	  box-sizing: content-box !important;
  }

  .el-aside-footer{
	  text-align: left;

  }

  #app {
	  height: 100%;
  }

	.el-container {
		height: 100%;
	}
	body > .el-container {
    margin-bottom: 40px;
  }

  .el-container:nth-child(5) .el-aside,
  .el-container:nth-child(6) .el-aside {
    line-height: 260px;
  }

  .el-container:nth-child(7) .el-aside {
    line-height: 320px;
  }

	.CodeMirror-line {
		line-height: 20px;
	}

	.el-menu {
		border: 0px;
	}

	.el-switch__core .el-switch__button{
		right: 1px;
	}
</style>
