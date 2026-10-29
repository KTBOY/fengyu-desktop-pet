@echo off
set ELECTRON_RUN_AS_NODE=
set MESH_PROTO_OUT=%~dp0mesh-proto\out
if not "%1"=="" set MESH_PROTO_SCHEME=%1
start /wait "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0mesh-proto\main.js"
echo exitcode=%errorlevel%
