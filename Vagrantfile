Vagrant.configure("2") do |config|
	config.vm.box = "bento/ubuntu-16.04"
	config.vm.network "private_network", ip: "192.168.33.10"
	config.vm.provision "shell" do |s|
		s.path = "provision.sh"
	end
end
