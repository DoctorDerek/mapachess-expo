Pod::Spec.new do |specification|
  specification.name = 'MapachessInput'
  specification.version = '0.1.0'
  specification.summary = 'Mapachess semantic hardware input adapter'
  specification.homepage = 'https://mapachess.com'
  specification.license = 'GPL-3.0-or-later'
  specification.author = 'Dr. Derek Austin'
  specification.platforms = { :ios => '15.1' }
  specification.source = { :git => 'https://github.com/DoctorDerek/mapachess-expo.git' }
  specification.static_framework = true
  specification.source_files = '**/*.swift'
  specification.dependency 'ExpoModulesCore'
  specification.frameworks = 'GameController'
end
