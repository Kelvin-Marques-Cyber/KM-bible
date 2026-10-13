Pod::Spec.new do |s|
  s.name = 'needle_runtime'
  s.version = '1.0.0'
  s.summary = 'Local structured intent runtime.'
  s.description = 'Needle 2 native library and local adapter.'
  s.homepage = 'https://github.com/cactus-compute/needle'
  s.license = { :type => 'Apache-2.0', :file => '../../../native/needle/LICENSE' }
  s.author = { 'Kelvin e Silva Marques' => 'kelvinkyu3211@hotmail.com' }
  s.source = { :path => '.' }
  s.source_files = 'Classes/**/*'
  s.vendored_frameworks = 'NeedleCore.xcframework'
  s.dependency 'Flutter'
  s.platform = :ios, '15.0'
  s.libraries = 'c++'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17' }
  s.user_target_xcconfig = { 'OTHER_LDFLAGS' => '$(inherited) -Wl,-u,_br_load -Wl,-u,_br_complete' }
end
