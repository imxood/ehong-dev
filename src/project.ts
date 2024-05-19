import { EventEmitter } from "events";
import { createHash } from "crypto";
import * as fs from "fs";
import path, { dirname, basename, extname, join } from "path";
import * as vscode from "vscode";
import * as xml2js from "xml2js";
import { exec } from "child_process";
import JSON5 from "json5";

export default class KeilProject extends EventEmitter {
  project: string = "";
  target_name: string = "";
  device: string = "";
  cpu: string = "";

  work_dir: string = "";
  vscode_root: string = "";

  running: boolean = false;
  channel: vscode.OutputChannel;

  get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("ehong-dev");
  }

  get logPath() {
    return join(this.vscode_root, "uv4.log");
  }

  constructor(channel: vscode.OutputChannel) {
    super();

    this.channel = channel;
  }

  // 解析项目, 生成 vscode 的 c++配置
  async load(work_dir: string) {
    this.project = "";
    this.work_dir = work_dir;
    this.vscode_root = join(work_dir, ".vscode");

    if (!fs.existsSync(this.vscode_root)) {
      fs.mkdirSync(this.vscode_root);
    }

    let ehong_config = join(work_dir, "ehong.json");

    // 解析 ehong.json 文件中的 project字段
    if (fs.existsSync(ehong_config)) {
      let data = JSON5.parse(fs.readFileSync(ehong_config, "utf-8"));
      if (typeof data === "object") {
        let project = data["project"];
        if (typeof project === "string") {
          this.project = data["project"] as string;
        }
      }
    }

    // 解析 project文件, 生产 vscode 的 c++配置文件
    if (this.project) {
      if (!path.isAbsolute(this.project)) {
        this.project = path.join(this.work_dir, this.project);
      }
      const parser = new xml2js.Parser({ explicitArray: false });
      const doc = await parser.parseStringPromise({
        toString: () => fs.readFileSync(this.project, "utf-8"),
      });
      const targets = doc["Project"]["Targets"]["Target"];
      this.target_name = targets["TargetName"];

      let target_common_option = targets["TargetOption"]["TargetCommonOption"];
      this.device = target_common_option["Device"];
      this.cpu = target_common_option["Cpu"];

      let various_controls =
        targets["TargetOption"]["TargetArmAds"]["Cads"]["VariousControls"];

      let project_dir = path.resolve(this.project, "..");

      let includes: string[] = [];
      (various_controls["IncludePath"] as string).split(";").forEach((v) => {
        includes.push(path.join(project_dir, v));
      });

      let defines: string[] = [];
      (various_controls["Define"] as string).split(",").forEach((v) => {
        v.split(" ").forEach((v) => {
          defines.push(v);
        });
      });

      console.log(`includes: ${includes}`);
      console.log(`defines: ${defines}`);

      let vscode_c_config = path.join(
        this.vscode_root,
        "c_cpp_properties.json"
      );

      fs.writeFileSync(
        vscode_c_config,
        JSON.stringify(
          {
            configurations: [
              {
                name: "Win32",
                defines: defines,
                includePath: includes,
              },
            ],
            version: 4,
          },
          null,
          2
        )
      );
    }
  }

  async build() {
    await this.run_keil("build");
  }

  async rebuild() {
    await this.run_keil("rebuild");
  }

  async clean() {
    await this.run_keil("clean");
  }

  private async run_keil(run_name: string) {
    if (!this.target_name) {
      vscode.window.showErrorMessage("keil项目文件中 未解析到 TargetName参数");
      return;
    }

    if (!this.project) {
      vscode.window.showErrorMessage("在 ehong.json 中, 未解析到 Project参数");
      return;
    }

    let type = "";
    if (run_name === "build") {
      type = "b";
    } else if (run_name === "rebuild") {
      type = "r";
    } else if (run_name === "clean") {
      type = "c";
    } else {
      vscode.window.showErrorMessage(
        `无效的运行选项: ${run_name}, 可选的是 build / rebuild / clean`
      );
      return;
    }

    let uv4_exe = this.config.get("Uv4Path") as string;

    if (!fs.existsSync(uv4_exe)) {
      vscode.window.showErrorMessage(`未找到 uv4_exe 路径, '${uv4_exe}'`);
      return;
    }

    // 清空日志文件
    fs.writeFileSync(this.logPath, "");

    let init_text = `\ndev: ${this.device}\ncpu: ${this.cpu}\n`;

    const command = `"${uv4_exe}" -${type} "${this.project}" -t ${this.target_name} -j0 -o "${this.logPath}"`;

    this.channel.show();
    this.channel.appendLine("$: " + run_name + " target " + this.target_name);

    let dots = 0;
    const timer = setInterval(() => {
      let text = `$: ${run_name} target  ${
        this.target_name
      }\n${init_text}\n${fs.readFileSync(this.logPath, "utf-8")}`;

      this.channel.replace(text);
    }, 200);

    return new Promise<void>((res) => {
      setTimeout(() => {
        exec(command).once("exit", () => {
          setTimeout(() => clearInterval(timer), 100);
          console.log("exe exited");
          res();
        });
      }, 500);
    });
  }
}
