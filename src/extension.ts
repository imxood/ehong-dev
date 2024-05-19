import * as vscode from "vscode";
import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import KeilProject from "./project";

export function activate(context: vscode.ExtensionContext) {
  const subscriber = context.subscriptions;

  const channel = vscode.window.createOutputChannel("ehong-dev");
  channel.appendLine("ehong dev plugin activated!");
  channel.show();

  let project = new KeilProject(channel);

  var workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    project.load(workspaceFolders[0].uri.fsPath);
  }

  const prevent = async (action: () => Promise<void>) => {
    if (project.running) {
      vscode.window.showWarningMessage("任务正在运行, 请稍后...");
      return;
    }
    project.running = true;
    try {
      await action.call(project);
    } finally {
      project.running = false;
    }
  };

  /* 监控 ehong.json 文件 的保存事件 */
  subscriber.push(
    vscode.workspace.onDidSaveTextDocument(async (event) => {
      if (event.fileName.endsWith("ehong.json")) {
        let workspace = vscode.workspace.getWorkspaceFolder(event.uri);
        if (workspace) {
          let work_dir = path.resolve(event.uri.fsPath, "..");
          if (project.work_dir == work_dir) {
            // 重新加载
            project.load(work_dir);
          }
        }
      }
    })
  );

  /* 注册 编译项目 命令 */
  subscriber.push(
    vscode.commands.registerCommand("ehong-dev.project.build", () =>
      prevent(project.build)
    )
  );

  /* 注册 重新编译项目 命令 */
  subscriber.push(
    vscode.commands.registerCommand("ehong-dev.project.rebuild", () =>
      prevent(project.rebuild)
    )
  );

  /* 注册 清理项目 命令 */
  subscriber.push(
    vscode.commands.registerCommand("ehong-dev.project.clean", () =>
      prevent(project.clean)
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}

function get_ehong_config(
  workspace: vscode.WorkspaceFolder | undefined
): string | undefined {
  if (workspace) {
    let config_file = path.normalize(workspace.uri.fsPath + "/ehong.json");

    if (fs.existsSync(config_file)) {
      return config_file;
    }
  }
}

function communicateWithExternalProcess(
  channel: vscode.OutputChannel,
  exe_path: string,
  eh_configs: string[]
) {
  let uv4_path =
    vscode.workspace.getConfiguration("ehong").get<string>("Uv4Path") || "";

  const child = child_process.spawn(exe_path, [
    "--uv4-path",
    uv4_path,
    "--configs",
    eh_configs.join(" "),
  ]);

  child.stdout.on("data", (data) => {
    let s: string = data.toString();
    channel.append(s);
    if (s.startsWith("TargetName: ")) {
      s = s.slice("TargetName: ".length);
      var v = s.indexOf("\r\n");
      var v = s.indexOf("\r\n");
      if (v != -1) {
        s = s.slice(0, v);
      }

      console.log(`TargetName: ${s}`);
    }
    console.log();
  });

  child.stderr.on("data", (data) => {
    channel.append(data.toString());
  });

  child.on("close", (code) => {
    channel.append(`External process exited with code ${code}`);

    let command = `${exe_path} --uv4-path ${uv4_path} --configs ${eh_configs.join(
      " "
    )}`;

    child_process
      .exec(
        "C:/Keil_v5/UV4/UV4.exe -r D:/work/6226master/applications/ble_app_findmy/keil/ble_app_findmy.uvprojx -j0 -t ble_app_findmy -o test_uv4.txt"
      )
      .once("exit", () => {
        //   setTimeout(() => clearInterval(timer), 100);
        console.log("exe exited");
        //   res();
      });

    // const task = new vscode.Task(
    //   { type: "keil-task" },
    //   vscode.TaskScope.Global,
    //   "build_task",
    //   "shell"
    // );

    // //
    // task.execution = new vscode.ShellExecution(
    //   //   cmdPrefixSuffix + commandLine + cmdPrefixSuffix
    //   "C:/Keil_v5/UV4/UV4.exe -r applications/ble_app_findmy/keil/ble_app_findmy.uvprojx -j0 -t ble_app_findmy"
    // );
    // task.isBackground = false;
    // // task.problemMatchers = this.getProblemMatcher();
    // task.presentationOptions = {
    //   echo: false,
    //   focus: false,
    //   clear: true,
    // };
    // vscode.tasks.executeTask(task);
  });
}
