"""Configure this host's toolchain and build a personally signed Android APK."""
import os,secrets,subprocess,urllib.parse,urllib.request
from pathlib import Path
R=Path(__file__).resolve().parents[1];T=R.parent/'tooling';private=R.parent/'private-signing';private.mkdir(mode=0o700,exist_ok=True)
p=private/'signing-password.txt'
if not p.exists():p.write_text(secrets.token_urlsafe(32));p.chmod(0o600)
password=p.read_text().strip();env=os.environ.copy();env.update(JAVA_HOME=str(T/'jdk17'),ANDROID_HOME=str(T/'android'),ANDROID_SDK_ROOT=str(T/'android'),CI='true',FLUTTER_SUPPRESS_ANALYTICS='true');env['PATH']=str(T/'jdk17/bin')+':'+env['PATH']
key=private/'biblia-release.jks'
if not key.exists():subprocess.run([str(T/'jdk17/bin/keytool'),'-genkeypair','-keystore',str(key),'-alias','kelvin-biblia','-keyalg','RSA','-keysize','4096','-validity','10000','-storepass:env','BIBLIA_SIGNING_PASSWORD','-keypass:env','BIBLIA_SIGNING_PASSWORD','-dname','CN=Kelvin e Silva Marques'],env={**env,'BIBLIA_SIGNING_PASSWORD':password},check=True)
(R/'android/key.properties').write_text('storeFile='+str(key)+'\nstorePassword='+password+'\nkeyPassword='+password+'\nkeyAlias=kelvin-biblia\n');(R/'android/key.properties').chmod(0o600)
(R/'android/local.properties').write_text('sdk.dir='+str(T/'android')+'\nflutter.sdk='+str(T/'flutter')+'\n')
proxy=urllib.parse.urlparse(os.environ['HTTPS_PROXY']);g=Path.home()/'.gradle';g.mkdir(exist_ok=True);(g/'gradle.properties').write_text(f'systemProp.http.proxyHost={proxy.hostname}\nsystemProp.http.proxyPort={proxy.port}\nsystemProp.https.proxyHost={proxy.hostname}\nsystemProp.https.proxyPort={proxy.port}\norg.gradle.daemon=false\norg.gradle.jvmargs=-Xmx3G\n')
with (R.parent/'recovery/android-build.log').open('w') as out:subprocess.run([str(T/'flutter/bin/flutter'),'--suppress-analytics','build','apk','--release','--target-platform','android-arm64','--no-pub'],env=env,stdout=out,stderr=subprocess.STDOUT,check=True,cwd=R)
