#!/bin/bash

HUB_CONFIG=~/.config/hub

function yn_prompt {
    local prompt=$1

    while true; do
        read -p "$prompt" yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes/no";;
        esac
    done
}

script_arg=$1

case $script_arg in
    git)
        git=true
        ;;
    npm_install)
        npm_install=true
        npm_remove_existing=$2
        ;;
    symlink)
        symlink=true
        ;;
    all)
        all=true
        ;;
    *)
        printf "Please pass either git, npm_install, symlink, or all in as a command.\n\n"
        printf "git:\n\tWill attempt to clone, fork, and add remotes to all relevant containership repos\n"
        printf "npm_install:\n\tWill run npm install in all the containership repos.\n\tAdd flag --remove-existing to wipe existing node_modules before installing\n"
        printf "symlink:\n\tWill attempt to symlink all containership repo node_modules to your corresponding git repo\n"
        printf "all:\n\tWill execute all of the above commands\n"
        exit 1
        ;;
esac

echo "Initializing the Containership development environment..."

if ! type "brew" > /dev/null; then
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
fi

brew install git
brew install hub

containership_dir=$(pwd)
yn_prompt "Would you like to initialize the dev environment in this directory? ($containership_dir) [y/n] "

if [ ! $? -eq 0 ]; then
    read -ep "Where would you like to set up the Containership development environment?`echo $'\n> '`" containership_dir
fi

cd $containership_dir
echo "Forking and cloning repositories into: [$containership_dir]"

containership_repos=(
    "containership"
    "containership.analytics"
    "containership.api"
    "containership.core"
    "containership.scheduler"
    "codexd"
    "ohai-data"
    "myriad-kv"
    "legiond"
    "praetor"
)

function setupRepo {
    repo=$1

    if [ "$all" == true ] || [ "$git" == true ]; then
        if [ ! -d "$repo" ]; then
            echo "Cloning $repo from containership..."
            git clone git@github.com:containership/$repo.git
        fi

        echo "Forking $repo (if not already forked) and adding remote..."
        cd $repo

        if [[ -z "$github_user" ]] || ! git remote -v | grep "$github_user" > /dev/null; then
            hub fork

            if [[ -z "$github_user" ]]; then
                github_user=$(grep -o 'user: .*' ~/.config/hub | awk '{print $2}')
            fi

            if git remote -v | grep "upstream" > /dev/null; then
                git remote remove upstream
            fi

            if git remote -v | grep "origin" > /dev/null; then
                git remote remove origin
            fi

            git remote add origin git@github.com:$github_user/$repo.git
            git remote add upstream git@github.com:containership/$repo.git
        fi

        cd $containership_dir
    fi

    if [ "$all" == true ] || [ "$npm_install" == true ]; then
        cd $repo

        if [ "$npm_remove_existing" == "--remove-existing" ]; then
            rm -rf ./node_modules/*
        fi

        npm install
        cd $containership_dir
    fi
}

for repo in ${containership_repos[@]}; do
    setupRepo $repo
done

if [ "$all" == true ] || [ "$symlink" == true ]; then
    for repo in ${containership_repos[@]}; do
        if [ -d $repo ]; then
            cd $repo/node_modules

            echo "Attempting to symlink all modules inside: $repo..."

            for repo in ${containership_repos[@]}; do
                if [ -d "$repo" ]; then
                    echo "Symlinking $repo -> ../../$repo"
                    rm -rf $repo
                    ln -sF ../../$repo $repo
                fi

                if [ -d "@containership/$repo" ]; then
                    echo "Symlinking @containership/$repo -> ../../../$repo"
                    rm -rf @containership/$repo
                    ln -sF ../../../$repo @containership/$repo
                fi
            done

            cd $containership_dir
        fi
    done
fi
