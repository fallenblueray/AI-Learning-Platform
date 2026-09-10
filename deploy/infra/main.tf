terraform {
  required_version = ">= 1.6.0"
  required_providers {
    digitalocean = { source = "digitalocean/digitalocean", version = "~> 2.96" }
  }
}
provider "digitalocean" {}
variable "project_name" { type = string }
variable "domain" { type = string }
variable "ssh_key_ids" { type = list(string) }
variable "admin_cidrs" {
  type = list(string)
  validation {
    condition     = length(var.admin_cidrs) > 0 && alltrue([for cidr in var.admin_cidrs : can(cidrhost(cidr, 0)) && cidr != "0.0.0.0/0" && cidr != "::/0"])
    error_message = "Provide restricted administrator CIDRs, not the entire internet."
  }
}
variable "bucket_name" { type = string }
resource "digitalocean_vpc" "platform" {
  name   = "${var.project_name}-vpc"
  region = "sgp1"
}
resource "digitalocean_droplet" "app" {
  name       = "${var.project_name}-app"
  region     = "sgp1"
  size       = "s-2vcpu-4gb"
  image      = "ubuntu-24-04-x64"
  ssh_keys   = var.ssh_key_ids
  vpc_uuid   = digitalocean_vpc.platform.id
  monitoring = true
  backups    = true
  user_data  = <<-CLOUD
    #cloud-config
    package_update: true
    packages:
      - docker.io
      - docker-compose-v2
      - mysql-client
      - awscli
    runcmd:
      - systemctl enable --now docker
      - mkdir -p /opt/pt-academy
      - chmod 700 /opt/pt-academy
    ssh_pwauth: false
  CLOUD
}
resource "digitalocean_firewall" "app" {
  name        = "${var.project_name}-firewall"
  droplet_ids = [digitalocean_droplet.app.id]
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.admin_cidrs
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "53"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
resource "digitalocean_database_cluster" "mysql" {
  name                 = "${var.project_name}-mysql"
  engine               = "mysql"
  version              = "8"
  size                 = "db-s-1vcpu-1gb"
  region               = "sgp1"
  node_count           = 1
  private_network_uuid = digitalocean_vpc.platform.id
  maintenance_window {
    day  = "sunday"
    hour = "18:00:00"
  }
}
resource "digitalocean_database_db" "platform" {
  cluster_id = digitalocean_database_cluster.mysql.id
  name       = "pt_academy"
}
resource "digitalocean_database_user" "app" {
  cluster_id = digitalocean_database_cluster.mysql.id
  name       = "pt_app"
}
resource "digitalocean_database_firewall" "database" {
  cluster_id = digitalocean_database_cluster.mysql.id
  rule {
    type  = "droplet"
    value = tostring(digitalocean_droplet.app.id)
  }
}
resource "digitalocean_spaces_bucket" "media" {
  name          = var.bucket_name
  region        = "sgp1"
  acl           = "private"
  force_destroy = false
  versioning { enabled = true }
}
resource "digitalocean_spaces_bucket_cors_configuration" "media" {
  bucket = digitalocean_spaces_bucket.media.name
  region = "sgp1"
  cors_rule {
    allowed_origins = ["https://${var.domain}"]
    allowed_methods = ["GET", "HEAD", "PUT"]
    allowed_headers = ["Content-Type", "x-amz-*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 600
  }
}
resource "digitalocean_spaces_bucket" "backups" {
  name          = "${var.bucket_name}-backups"
  region        = "sgp1"
  acl           = "private"
  force_destroy = false
  versioning { enabled = true }
}
output "app_ip" { value = digitalocean_droplet.app.ipv4_address }
output "database_private_host" { value = digitalocean_database_cluster.mysql.private_host }
output "database_port" { value = digitalocean_database_cluster.mysql.port }
output "database_user" { value = digitalocean_database_user.app.name }
output "database_password" {
  value     = digitalocean_database_user.app.password
  sensitive = true
}
output "media_origin" { value = "https://${var.bucket_name}.sgp1.digitaloceanspaces.com" }
