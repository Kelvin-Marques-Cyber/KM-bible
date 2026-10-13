#include <cstdlib>
#include <fstream>
#include <mutex>
#include <vector>
#include "needle.h"
static std::vector<unsigned char> model;
static std::mutex engine;
static bool loaded=false;
extern "C" __attribute__((visibility("default"),used)) int br_load(const char* path,const char* tools) {
 std::lock_guard<std::mutex> lock(engine);
 setenv("NEEDLE_TELEMETRY","0",1);setenv("DO_NOT_TRACK","1",1);
 if(!loaded){std::ifstream file(path,std::ios::binary|std::ios::ate);if(!file)return -100;auto n=file.tellg();if(n<=0||n>32*1024*1024)return -101;model.resize(static_cast<size_t>(n));file.seekg(0);if(!file.read(reinterpret_cast<char*>(model.data()),n))return -102;int rc=needle_load(model.data(),model.size());if(rc<0)return rc;loaded=true;}
 return needle_init("locale: pt-BR\nnetwork: offline",tools,nullptr);
}
extern "C" __attribute__((visibility("default"),used)) int br_complete(const char* prompt,char* out,int capacity) {
 std::lock_guard<std::mutex> lock(engine);if(!loaded)return -103;needle_reset();return needle_complete(prompt,256,out,capacity);
}
