# ehong-dev 插件

## 用法

### 配置

使用 vscode 打开一个文件夹, 在打开的 根路径下 创建一个 ehong.json 文件

在 ehong.json 中 输入, project 为 keil 项目路径, 可以是 绝对路径 或 相对于根路径:

```js
{
    "project": "xxx/xx/xx.uvprojx",
}
```

这将触发 插件, 生成 vscode 的 c++代码提示配置文件 .vscode/c_cpp_properties.json

### 编译

按下 ctrl + shift + p, 在弹框中 输入: ehong build, 将选中 编译的命令, 执行回车

### 重新编译

ehong rebuild

### 清除编译

ehong clean
